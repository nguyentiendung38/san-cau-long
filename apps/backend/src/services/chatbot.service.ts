import { GoogleGenerativeAI, Tool, FunctionDeclaration } from '@google/generative-ai';
import prisma from '../config/database.js';
import { format, startOfDay } from 'date-fns';
import { AppError } from '../middleware/error.js';
import { bookingService } from './booking.service.js';

// ============================================================
// KHỞI TẠO GEMINI AI
// ============================================================
let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
    // Đọc key động mỗi lần gọi để đảm bảo nhận đúng giá trị từ .env
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY chưa được cấu hình trong .env');
    }
    // Tạo lại instance nếu chưa có hoặc key thay đổi
    if (!genAI) {
        genAI = new GoogleGenerativeAI(apiKey);
    }
    return genAI;
}

// ============================================================
// KIỂU DỮ LIỆU
// ============================================================
export interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

export interface ChatSession {
    messages: ChatMessage[];
    venueId?: string;
}

function getProviderRetryDelayMs(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') return undefined;

    const providerError = error as {
        status?: unknown;
        errorDetails?: Array<Record<string, unknown>>;
        message?: unknown;
    };
    if (providerError.status !== 429) return undefined;

    for (const detail of providerError.errorDetails || []) {
        const metadata = detail.metadata;
        const retryDelay = metadata && typeof metadata === 'object'
            ? (metadata as Record<string, unknown>).retryDelay
            : detail.retryDelay;
        if (typeof retryDelay === 'string') {
            const match = /^(\d+(?:\.\d+)?)(ms|s|m|h)$/.exec(retryDelay.trim());
            if (match) {
                const unitsInMs = { ms: 1, s: 1000, m: 60000, h: 3600000 };
                const delayMs = Number.parseFloat(match[1]) * unitsInMs[match[2] as keyof typeof unitsInMs];
                if (Number.isFinite(delayMs) && delayMs > 0) return delayMs;
            }
        }
    }

    if (typeof providerError.message === 'string') {
        const retryInMatch = providerError.message.match(/retry in\s+(\d+(?:\.\d+)?)\s*(ms|s|m|h)/i);
        if (retryInMatch) {
            const unitsInMs = { ms: 1, s: 1000, m: 60000, h: 3600000 };
            const delayMs = Number.parseFloat(retryInMatch[1]) *
                unitsInMs[retryInMatch[2].toLowerCase() as keyof typeof unitsInMs];
            if (Number.isFinite(delayMs) && delayMs > 0) return delayMs;
        }
    }

    return undefined;
}

async function sendMessageWithRetry<T>(send: () => Promise<T>): Promise<T> {
    const maxRetries = 1;
    for (let attempt = 1; ; attempt++) {
        try {
            return await send();
        } catch (error) {
            const status = error && typeof error === 'object'
                ? (error as { status?: unknown }).status
                : undefined;
            if (status !== 429 || attempt > maxRetries) throw error;

            const providerDelayMs = getProviderRetryDelayMs(error);
            if (providerDelayMs !== undefined && providerDelayMs > 30000) {
                const retryAfterSeconds = Math.ceil(providerDelayMs / 1000);
                Object.assign(error, { retryAfterSeconds });
                console.warn('[Chatbot] Gemini rate limit; defer retry to client', {
                    retryAfterSeconds,
                });
                throw error;
            }

            const delayMs = (providerDelayMs ?? 1000 * 2 ** (attempt - 1)) + 2000;
            console.warn('[Chatbot] Gemini returned 429; retrying once', { attempt, delayMs });
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
}

// ============================================================
// FUNCTION TOOLS CHO GEMINI (Function Calling)
// ============================================================
const tools: Tool[] = [
    {
        functionDeclarations: [
            {
                name: 'get_venues',
                description: 'Lấy danh sách cơ sở đang hoạt động và giờ hoạt động đã cấu hình theo từng ngày. Bắt buộc dùng khi khách hỏi giờ mở cửa.',
                parameters: {
                    type: 'OBJECT' as any,
                    properties: {},
                    required: [],
                },
            } as FunctionDeclaration,
            {
                name: 'get_courts',
                description: 'Lấy danh sách các sân tại một cơ sở. Trả về tên sân, trạng thái, loại mặt sân.',
                parameters: {
                    type: 'OBJECT' as any,
                    properties: {
                        venue_id: {
                            type: 'STRING' as any,
                            description: 'ID của cơ sở sân. Nếu không biết, gọi get_venues trước.',
                        },
                    },
                    required: ['venue_id'],
                },
            } as FunctionDeclaration,
            {
                name: 'check_availability',
                description: 'Kiểm tra lịch trống của sân trong ngày. Trả về các khung giờ còn trống và đã đặt.',
                parameters: {
                    type: 'OBJECT' as any,
                    properties: {
                        venue_id: {
                            type: 'STRING' as any,
                            description: 'ID của cơ sở sân',
                        },
                        date: {
                            type: 'STRING' as any,
                            description: 'Ngày cần kiểm tra theo định dạng YYYY-MM-DD. Ví dụ: 2026-09-15',
                        },
                    },
                    required: ['venue_id', 'date'],
                },
            } as FunctionDeclaration,
            {
                name: 'get_booking_quote',
                description: 'Kiểm tra một yêu cầu đặt sân cụ thể có đúng giờ hoạt động, còn trống và tính giá chính xác theo bảng giá hiện tại. Bắt buộc gọi trước khi báo giá và xin khách xác nhận đặt.',
                parameters: {
                    type: 'OBJECT' as any,
                    properties: {
                        court_id: { type: 'STRING' as any, description: 'ID sân' },
                        date: { type: 'STRING' as any, description: 'Ngày YYYY-MM-DD' },
                        start_time: { type: 'STRING' as any, description: 'Giờ bắt đầu HH:MM' },
                        end_time: { type: 'STRING' as any, description: 'Giờ kết thúc HH:MM' },
                    },
                    required: ['court_id', 'date', 'start_time', 'end_time'],
                },
            } as FunctionDeclaration,
            {
                name: 'get_pricing',
                description: 'Lấy bảng giá sân hiện tại của một cơ sở',
                parameters: {
                    type: 'OBJECT' as any,
                    properties: {
                        venue_id: {
                            type: 'STRING' as any,
                            description: 'ID của cơ sở sân',
                        },
                    },
                    required: ['venue_id'],
                },
            } as FunctionDeclaration,
            {
                name: 'find_customer_by_phone',
                description: 'Tìm thông tin khách hàng theo số điện thoại. Dùng khi khách muốn đặt sân và cần xác nhận thông tin.',
                parameters: {
                    type: 'OBJECT' as any,
                    properties: {
                        phone: {
                            type: 'STRING' as any,
                            description: 'Số điện thoại khách hàng',
                        },
                    },
                    required: ['phone'],
                },
            } as FunctionDeclaration,
            {
                name: 'create_booking',
                description: 'Tạo lịch đặt sân mới sau khi đã xác nhận đủ thông tin với khách hàng',
                parameters: {
                    type: 'OBJECT' as any,
                    properties: {
                        court_id: {
                            type: 'STRING' as any,
                            description: 'ID của sân cần đặt',
                        },
                        customer_phone: {
                            type: 'STRING' as any,
                            description: 'Số điện thoại khách hàng (để tìm hoặc tạo mới)',
                        },
                        customer_name: {
                            type: 'STRING' as any,
                            description: 'Tên khách hàng (cần thiết nếu khách chưa có trong hệ thống)',
                        },
                        date: {
                            type: 'STRING' as any,
                            description: 'Ngày đặt sân định dạng YYYY-MM-DD',
                        },
                        start_time: {
                            type: 'STRING' as any,
                            description: 'Giờ bắt đầu định dạng HH:MM (ví dụ: 07:00)',
                        },
                        end_time: {
                            type: 'STRING' as any,
                            description: 'Giờ kết thúc định dạng HH:MM (ví dụ: 09:00)',
                        },
                        notes: {
                            type: 'STRING' as any,
                            description: 'Ghi chú thêm (tùy chọn)',
                        },
                    },
                    required: ['court_id', 'customer_phone', 'date', 'start_time', 'end_time'],
                },
            } as FunctionDeclaration,
            {
                name: 'get_customer_bookings',
                description: 'Xem lịch đặt sân của một khách hàng theo số điện thoại',
                parameters: {
                    type: 'OBJECT' as any,
                    properties: {
                        phone: {
                            type: 'STRING' as any,
                            description: 'Số điện thoại khách hàng',
                        },
                    },
                    required: ['phone'],
                },
            } as FunctionDeclaration,
        ] as FunctionDeclaration[],
    },
];

// ============================================================
// CÁC HÀM THỰC THI (Tool Handlers)
// ============================================================

async function handleGetVenues(): Promise<string> {
    const venues = await prisma.venue.findMany({
        where: { isActive: true },
        select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            operatingHours: {
                where: { isActive: true },
                orderBy: { startTime: 'asc' },
                select: { startTime: true, endTime: true, daysOfWeek: true },
            },
        },
    });

    if (venues.length === 0) return 'Hiện tại chưa có cơ sở nào hoạt động.';

    const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
    const result = venues.map((venue) => ({
        id: venue.id,
        name: venue.name,
        address: venue.address,
        phone: venue.phone,
        operatingHours: venue.operatingHours.length > 0
            ? venue.operatingHours.map((hours) => {
                let days: unknown;
                try {
                    days = JSON.parse(hours.daysOfWeek);
                } catch {
                    return {
                        startTime: hours.startTime,
                        endTime: hours.endTime,
                        days: 'Lịch ngày chưa được cấu hình hợp lệ',
                    };
                }

                if (!Array.isArray(days) || !days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)) {
                    return {
                        startTime: hours.startTime,
                        endTime: hours.endTime,
                        days: 'Lịch ngày chưa được cấu hình hợp lệ',
                    };
                }

                return {
                    startTime: hours.startTime,
                    endTime: hours.endTime,
                    days: days.length === 0
                        ? 'Chưa cấu hình ngày hoạt động'
                        : days.length === 7
                            ? 'Tất cả các ngày'
                            : days.map((day) => dayNames[day]).join(', '),
                };
            })
            : 'Chưa cấu hình giờ hoạt động',
    }));

    return JSON.stringify(result);
}

async function handleGetCourts(venueId: string): Promise<string> {
    const courts = await prisma.court.findMany({
        where: { venueId, status: 'ACTIVE' },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, surfaceType: true, isIndoor: true, status: true },
    });

    if (courts.length === 0) return `Cơ sở này chưa có sân nào hoạt động.`;

    return JSON.stringify(courts);
}

async function handleCheckAvailability(venueId: string, date: string): Promise<string> {
    const targetDate = parseBookingDate(date);
    const dayStart = startOfDay(targetDate);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const courts = await prisma.court.findMany({
        where: { venueId, status: 'ACTIVE' },
        orderBy: { sortOrder: 'asc' },
        include: {
            bookings: {
                where: {
                    date: { gte: dayStart, lte: dayEnd },
                    status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
                },
                select: { startTime: true, endTime: true, status: true },
            },
        },
    });

    const result = courts.map((court) => {
        const bookedSlots = court.bookings.map((b) => `${b.startTime}-${b.endTime}`);
        return {
            court: court.name,
            court_id: court.id,
            booked_slots: bookedSlots,
            available_hint: bookedSlots.length === 0 ? 'Còn trống cả ngày' : 'Có một số khung giờ đã đặt',
        };
    });

    return JSON.stringify({ date, courts: result });
}

function parseBookingDate(value: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
        throw new AppError(400, 'Ngày đặt sân phải có định dạng YYYY-MM-DD.');
    }

    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(year, month - 1, day, 12);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        throw new AppError(400, 'Ngày đặt sân không hợp lệ.');
    }
    if (startOfDay(date) < startOfDay(new Date())) {
        throw new AppError(400, 'Không thể đặt sân vào ngày đã qua.');
    }
    return date;
}

function parseBookingTimes(startTime: string, endTime: string) {
    const parseTime = (value: string) => {
        const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
        if (!match) throw new AppError(400, 'Giờ đặt sân phải có định dạng HH:MM.');
        return Number(match[1]) * 60 + Number(match[2]);
    };

    const start = parseTime(startTime);
    const end = parseTime(endTime);
    if (end <= start) throw new AppError(400, 'Giờ kết thúc phải sau giờ bắt đầu.');
    if (start % 30 !== 0 || end % 30 !== 0) {
        throw new AppError(400, 'Giờ đặt sân phải theo khung 30 phút.');
    }
    return { start, end };
}

async function getBookingQuote(params: {
    court_id: string;
    date: string;
    start_time: string;
    end_time: string;
}) {
    const date = parseBookingDate(params.date);
    const { start, end } = parseBookingTimes(params.start_time, params.end_time);
    if (startOfDay(date).getTime() === startOfDay(new Date()).getTime()) {
        const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();
        if (start <= currentMinutes) {
            throw new AppError(400, 'Không thể đặt khung giờ đã bắt đầu hoặc đã qua.');
        }
    }
    const court = await prisma.court.findUnique({
        where: { id: params.court_id },
        include: {
            venue: {
                include: {
                    operatingHours: {
                        where: { isActive: true },
                        select: { startTime: true, endTime: true, daysOfWeek: true },
                    },
                },
            },
        },
    });

    if (!court || court.status !== 'ACTIVE' || !court.venue.isActive) {
        throw new AppError(404, 'Không tìm thấy sân đang hoạt động.');
    }

    const venueOpening = parseBookingTimes(court.venue.openTime, court.venue.closeTime);
    if (start < venueOpening.start || end > venueOpening.end) {
        throw new AppError(400, `Cơ sở ${court.venue.name} hoạt động từ ${court.venue.openTime} đến ${court.venue.closeTime}.`);
    }

    const windows = court.venue.operatingHours.length > 0
        ? court.venue.operatingHours.flatMap((hours) => {
            let days: unknown;
            try {
                days = JSON.parse(hours.daysOfWeek);
            } catch {
                throw new AppError(400, `Cơ sở ${court.venue.name} có lịch hoạt động chưa hợp lệ.`);
            }
            if (!Array.isArray(days) || !days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)) {
                throw new AppError(400, `Cơ sở ${court.venue.name} có lịch hoạt động chưa hợp lệ.`);
            }
            return days.includes(date.getDay()) ? [{ startTime: hours.startTime, endTime: hours.endTime }] : [];
        })
        : [{ startTime: court.venue.openTime, endTime: court.venue.closeTime }];

    const isWithinOperatingHours = windows.some((window) => {
        const opening = parseBookingTimes(window.startTime, window.endTime);
        return start >= opening.start && end <= opening.end;
    });
    if (!isWithinOperatingHours) {
        const dayNames = ['Chủ nhật', 'thứ hai', 'thứ ba', 'thứ tư', 'thứ năm', 'thứ sáu', 'thứ bảy'];
        const hoursText = windows.length > 0
            ? windows.map((window) => `${window.startTime}-${window.endTime}`).join(', ')
            : `cơ sở nghỉ ${dayNames[date.getDay()]}`;
        throw new AppError(400, `Khung giờ yêu cầu nằm ngoài giờ hoạt động (${hoursText}).`);
    }

    const availability = await bookingService.checkAvailability(
        court.id,
        date,
        params.start_time,
        params.end_time
    );
    if (!availability.available) {
        throw new AppError(409, `Sân ${court.name} đã có lịch trong khung giờ ${params.start_time}-${params.end_time}.`);
    }

    const pricing = await bookingService.calculatePrice(court.id, date, params.start_time, params.end_time);
    if (pricing.total <= 0 || pricing.appliedRule?.startsWith('Chưa thiết lập giá')) {
        throw new AppError(400, `Chưa có bảng giá áp dụng cho khung giờ ${params.start_time}-${params.end_time}.`);
    }

    return { court, date, pricing };
}

async function handleGetBookingQuote(params: {
    court_id: string;
    date: string;
    start_time: string;
    end_time: string;
}): Promise<string> {
    try {
        const { court, date, pricing } = await getBookingQuote(params);
        return JSON.stringify({
            available: true,
            venue: court.venue.name,
            court: court.name,
            date: format(date, 'dd/MM/yyyy'),
            startTime: params.start_time,
            endTime: params.end_time,
            durationHours: pricing.duration,
            price: pricing.total,
            priceFormatted: `${pricing.total.toLocaleString('vi-VN')}đ`,
            pricingRules: pricing.appliedRule,
        });
    } catch (error) {
        if (error instanceof AppError) return JSON.stringify({ available: false, message: error.message });
        throw error;
    }
}

async function handleGetPricing(venueId: string): Promise<string> {
    const rules = await prisma.pricingRule.findMany({
        where: { venueId, isActive: true },
        orderBy: { priority: 'desc' },
        select: { name: true, dayOfWeek: true, startTime: true, endTime: true, pricePerHour: true },
    });

    if (rules.length === 0) return 'Cơ sở này chưa thiết lập bảng giá.';

    return JSON.stringify(
        rules.map((r) => ({
            name: r.name,
            day: r.dayOfWeek || 'Tất cả các ngày',
            from: r.startTime || 'Mở cửa',
            to: r.endTime || 'Đóng cửa',
            price_per_hour: `${r.pricePerHour.toLocaleString('vi-VN')}đ/giờ`,
        }))
    );
}

async function handleFindCustomerByPhone(phone: string): Promise<string> {
    const customer = await prisma.customer.findUnique({
        where: { phone },
        select: {
            id: true, name: true, phone: true, membershipTier: true,
            totalBookings: true, points: true, isActive: true,
        },
    });

    if (!customer) return `Không tìm thấy khách hàng với số điện thoại ${phone}. Đây có thể là khách mới.`;

    return JSON.stringify(customer);
}

async function handleCreateBooking(params: {
    court_id: string;
    customer_phone: string;
    customer_name?: string;
    date: string;
    start_time: string;
    end_time: string;
    notes?: string;
}): Promise<string> {
    try {
        if (!params.customer_phone?.trim()) {
            throw new AppError(400, 'Cần số điện thoại khách hàng để tạo lịch đặt.');
        }
        const { court, date, pricing } = await getBookingQuote({
            court_id: params.court_id,
            date: params.date,
            start_time: params.start_time,
            end_time: params.end_time,
        });

        let customer = await prisma.customer.findUnique({
            where: { phone: params.customer_phone },
        });

        if (!customer && !params.customer_name?.trim()) {
            throw new AppError(400, 'Khách mới cần cung cấp tên trước khi đặt sân.');
        }
        if (!customer) {
            customer = await prisma.customer.create({
                data: {
                    name: params.customer_name!.trim(),
                    phone: params.customer_phone,
                },
            });
        }

        const { booking } = await bookingService.create({
            courtId: court.id,
            customerId: customer.id,
            date,
            startTime: params.start_time,
            endTime: params.end_time,
            notes: params.notes ? `[Chatbot AI] ${params.notes}` : '[Chatbot AI]',
        });

        return JSON.stringify({
            success: true,
            booking_id: booking.id,
            message: `✅ Đặt sân thành công!`,
            details: {
                venue: court.venue.name,
                court: booking.court.name,
                customer: booking.customer?.name || customer.name,
                date: format(date, 'dd/MM/yyyy'),
                time: `${booking.startTime} - ${booking.endTime}`,
                amount: `${booking.totalAmount.toLocaleString('vi-VN')}đ`,
                status: booking.status,
                paymentStatus: booking.paymentStatus,
                message: `Lịch đã được thêm vào lịch đặt sân tại ${court.venue.name}.`,
                pricingRule: pricing.appliedRule,
            },
        });
    } catch (error) {
        if (error instanceof AppError) {
            return JSON.stringify({ success: false, message: error.message });
        }
        throw error;
    }
}

async function handleGetCustomerBookings(phone: string): Promise<string> {
    const customer = await prisma.customer.findUnique({
        where: { phone },
        include: {
            bookings: {
                where: { date: { gte: new Date() } },
                orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
                take: 10,
                include: { court: { select: { name: true } } },
            },
        },
    });

    if (!customer) return `Không tìm thấy khách hàng với số điện thoại ${phone}.`;

    if (customer.bookings.length === 0) {
        return `Khách hàng ${customer.name} chưa có lịch đặt sân nào sắp tới.`;
    }

    const bookings = customer.bookings.map((b) => ({
        court: b.court.name,
        date: format(new Date(b.date), 'dd/MM/yyyy'),
        time: `${b.startTime} - ${b.endTime}`,
        status: b.status,
        amount: `${b.totalAmount.toLocaleString('vi-VN')}đ`,
    }));

    return JSON.stringify({ customer: customer.name, upcoming_bookings: bookings });
}

// ============================================================
// DISPATCHER — Chọn hàm tương ứng với function name
// ============================================================
async function executeTool(name: string, args: Record<string, any>): Promise<string> {
    switch (name) {
        case 'get_venues':
            return handleGetVenues();
        case 'get_courts':
            return handleGetCourts(args.venue_id);
        case 'check_availability':
            return handleCheckAvailability(args.venue_id, args.date);
        case 'get_booking_quote':
            return handleGetBookingQuote(args as {
                court_id: string;
                date: string;
                start_time: string;
                end_time: string;
            });
        case 'get_pricing':
            return handleGetPricing(args.venue_id);
        case 'find_customer_by_phone':
            return handleFindCustomerByPhone(args.phone);
        case 'create_booking':
            return handleCreateBooking(args as any);
        case 'get_customer_bookings':
            return handleGetCustomerBookings(args.phone);
        default:
            return `Không tìm thấy hàm ${name}`;
    }
}

function isExplicitBookingConfirmation(message: string): boolean {
    const normalized = message
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    if (/\b(khong|chua|khoan|doi|sua|thay)\b/.test(normalized)) return false;
    return /\b(dong y|ok|oke|okay|xac nhan|chot|dat di|dat luon|dung roi|duoc)\b/.test(normalized);
}

// ============================================================
// SYSTEM PROMPT — Nhân cách chatbot
// ============================================================
const SYSTEM_PROMPT = `Bạn là **Courtify AI** — trợ lý thông minh của hệ thống quản lý sân cầu lông Courtify.

## NHIỆM VỤ CỦA BẠN:
- Giúp khách hàng đặt sân cầu lông nhanh chóng, dễ dàng
- Trả lời câu hỏi về lịch sân, giá cả, cơ sở
- Hỗ trợ xem lịch đặt sân của khách
- Tư vấn gói thành viên phù hợp

## PHONG CÁCH:
- Thân thiện, chuyên nghiệp, ngắn gọn
- Dùng tiếng Việt
- Dùng emoji phù hợp 🏸
- Nếu thông tin chưa đủ, hỏi thêm từng bước (không hỏi nhiều câu cùng lúc)

## QUY TRÌNH ĐẶT SÂN:
1. Thu thập cơ sở, sân, ngày, giờ bắt đầu, giờ kết thúc và số điện thoại; hỏi từng thông tin còn thiếu.
2. Dùng get_venues/get_courts để xác định đúng cơ sở và ID sân; không tự đoán ID hoặc tên sân.
3. Gọi get_booking_quote với đúng sân, ngày và giờ để kiểm tra lịch hoạt động, chỗ trống và giá theo bảng giá thật.
4. Thông báo lại cơ sở, sân, ngày, giờ, thời lượng và tổng giá do get_booking_quote trả về; xin khách xác nhận rõ ràng.
5. Với khách mới, hỏi tên. Gọi find_customer_by_phone để xác định khách đã tồn tại hay chưa.
6. Chỉ sau khi khách xác nhận rõ các thông tin và giá, gọi create_booking với các thông tin đó. Tool sẽ kiểm tra lại giờ, chỗ trống và giá trước khi ghi vào hệ thống.
7. Chỉ báo đặt thành công khi create_booking trả success=true; đọc lại mã lịch, sân, ngày giờ, giá và trạng thái thanh toán từ kết quả.

## LƯU Ý QUAN TRỌNG:
- KHÔNG tự ý tạo booking mà chưa xác nhận với khách
- Không tự tính hoặc đoán giá; dùng get_booking_quote để lấy giá chính xác.
- Không được báo còn sân chỉ dựa vào danh sách lịch trong ngày; kiểm tra đúng khung giờ.
- Không đặt sân ngoài giờ hoạt động theo lịch cấu hình.
- Khi hỏi ngày: nếu khách nói "hôm nay", "ngày mai", hãy tính theo ngày hiện tại ${format(new Date(), 'dd/MM/yyyy')}
- Khi khách hỏi giờ hoạt động, luôn gọi get_venues để tra cấu hình từng cơ sở; chỉ trả giờ có trong dữ liệu đó.
- Không được tự suy đoán giờ mở/đóng cửa từ giờ mặc định hoặc giờ trong bảng giá.
- Nếu khách chưa nêu cơ sở, liệt kê lịch từng cơ sở; nếu lịch ghi "Chưa cấu hình giờ hoạt động", nói rõ cơ sở chưa cập nhật giờ.
- Days trong kết quả được ghi rõ theo thứ trong tuần; không tự quy đổi hoặc gộp lịch khác nhau.

Hôm nay là: ${format(new Date(), 'EEEE, dd/MM/yyyy')}.`;

// ============================================================
// HÀM CHÍNH: Xử lý cuộc hội thoại
// ============================================================
export async function processChat(
    userMessage: string,
    history: ChatMessage[]
): Promise<{ reply: string; updatedHistory: ChatMessage[]; bookingCreated: boolean }> {
    const ai = getGenAI();

    const model = ai.getGenerativeModel({
        model: 'gemini-3.6-flash',
        tools,
        systemInstruction: SYSTEM_PROMPT,
    });

    // Chuyển đổi history sang định dạng Gemini
    const geminiHistory = history.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({ history: geminiHistory });

    // Gửi tin nhắn người dùng
    let response = await sendMessageWithRetry(() => chat.sendMessage(userMessage));
    let responseText = response.response.text();
    let bookingCreated = false;
    const previousAssistantMessage = [...history].reverse().find((message) => message.role === 'model');
    const previousAssistantAskedForConfirmation = previousAssistantMessage
        ? /xác nhận|đồng ý|chốt/i.test(previousAssistantMessage.content)
        : false;
    const canCreateBooking = previousAssistantAskedForConfirmation && isExplicitBookingConfirmation(userMessage);

    // Vòng lặp xử lý Function Calling
    let iteration = 0;
    const MAX_ITERATIONS = 5;

    while (iteration < MAX_ITERATIONS) {
        const functionCalls = response.response.functionCalls();
        if (!functionCalls || functionCalls.length === 0) break;

        iteration++;

        // Thực thi tất cả function calls và gộp kết quả thành text để vượt qua lỗi SDK
        let systemToolResult = "Hệ thống đã thực thi các lệnh bạn yêu cầu và trả về kết quả sau:\n\n";
        
        for (const fc of functionCalls) {
            const result = fc.name === 'create_booking' && !canCreateBooking
                ? JSON.stringify({
                    success: false,
                    message: 'Chưa được tạo lịch: cần báo lại sân, ngày, giờ và giá để khách xác nhận rõ ràng trước.',
                })
                : await executeTool(fc.name, fc.args as Record<string, any>);
            if (fc.name === 'create_booking') {
                try {
                    const parsedResult = JSON.parse(result) as {
                        success?: boolean;
                        booking_id?: string;
                        details?: {
                            venue?: string;
                            court?: string;
                            customer?: string;
                            date?: string;
                            time?: string;
                            amount?: string;
                        };
                    };
                    bookingCreated = bookingCreated || parsedResult.success === true;
                    if (parsedResult.success && parsedResult.details) {
                        const details = parsedResult.details;
                        responseText = [
                            '✅ Đặt sân thành công! Lịch đã được thêm vào hệ thống.',
                            details.venue && `Cơ sở: ${details.venue}`,
                            details.court && `Sân: ${details.court}`,
                            details.date && `Ngày: ${details.date}`,
                            details.time && `Giờ: ${details.time}`,
                            details.customer && `Khách hàng: ${details.customer}`,
                            details.amount && `Tổng tiền: ${details.amount}`,
                            parsedResult.booking_id && `Mã lịch: ${parsedResult.booking_id}`,
                            'Trạng thái thanh toán: Chưa thanh toán.',
                        ].filter(Boolean).join('\n');
                    }
                } catch {
                    bookingCreated = false;
                }
            }
            systemToolResult += `[Kết quả từ hàm ${fc.name}]:\n${result}\n\n`;
        }
        if (bookingCreated) break;

        systemToolResult += "Dựa vào kết quả trên, hãy trả lời câu hỏi của người dùng.";

        // Gửi text thay vì object functionResponse để tránh lỗi "Role 'function' is not supported" của model mới
        response = await sendMessageWithRetry(() => chat.sendMessage(systemToolResult));
        responseText = response.response.text();
    }

    // Cập nhật lịch sử chat
    const updatedHistory: ChatMessage[] = [
        ...history,
        { role: 'user', content: userMessage },
        { role: 'model', content: responseText },
    ];

    // Giới hạn lịch sử 20 tin nhắn gần nhất
    const trimmedHistory = updatedHistory.slice(-20);

    return { reply: responseText, updatedHistory: trimmedHistory, bookingCreated };
}
