import { GoogleGenerativeAI, Tool, FunctionDeclaration } from '@google/generative-ai';
import prisma from '../config/database.js';
import { format, addDays, startOfDay } from 'date-fns';

// ============================================================
// KHỞI TẠO GEMINI AI
// ============================================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
    if (!genAI) {
        if (!GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY chưa được cấu hình trong .env');
        }
        genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
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

// ============================================================
// FUNCTION TOOLS CHO GEMINI (Function Calling)
// ============================================================
const tools: Tool[] = [
    {
        functionDeclarations: [
            {
                name: 'get_venues',
                description: 'Lấy danh sách tất cả cơ sở sân cầu lông đang hoạt động',
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
        select: { id: true, name: true, address: true, phone: true, openTime: true, closeTime: true },
    });

    if (venues.length === 0) return 'Hiện tại chưa có cơ sở nào hoạt động.';

    return JSON.stringify(
        venues.map((v) => ({
            id: v.id,
            name: v.name,
            address: v.address,
            phone: v.phone,
            openTime: v.openTime,
            closeTime: v.closeTime,
        }))
    );
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
    const targetDate = new Date(date);

    const courts = await prisma.court.findMany({
        where: { venueId, status: 'ACTIVE' },
        orderBy: { sortOrder: 'asc' },
        include: {
            bookings: {
                where: {
                    date: startOfDay(targetDate),
                    status: { notIn: ['CANCELLED'] },
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
        // Tìm hoặc tạo khách hàng
        let customer = await prisma.customer.findUnique({
            where: { phone: params.customer_phone },
        });

        if (!customer && params.customer_name) {
            customer = await prisma.customer.create({
                data: {
                    name: params.customer_name,
                    phone: params.customer_phone,
                },
            });
        }

        // Kiểm tra sân tồn tại
        const court = await prisma.court.findUnique({
            where: { id: params.court_id },
            include: { venue: { select: { id: true } } },
        });

        if (!court) return 'Không tìm thấy sân này. Vui lòng kiểm tra lại.';

        const bookingDate = startOfDay(new Date(params.date));

        // Kiểm tra trùng lịch
        const conflicting = await prisma.booking.findFirst({
            where: {
                courtId: params.court_id,
                date: bookingDate,
                status: { notIn: ['CANCELLED'] },
                OR: [
                    {
                        startTime: { lt: params.end_time },
                        endTime: { gt: params.start_time },
                    },
                ],
            },
        });

        if (conflicting) {
            return `❌ Khung giờ ${params.start_time}-${params.end_time} ngày ${params.date} đã được đặt. Vui lòng chọn khung giờ khác.`;
        }

        // Tính giá
        const pricingRules = await prisma.pricingRule.findMany({
            where: { venueId: court.venue.id, isActive: true },
            orderBy: { priority: 'desc' },
        });

        let pricePerHour = 100000; // mặc định
        for (const rule of pricingRules) {
            if (rule.startTime && rule.endTime) {
                if (params.start_time >= rule.startTime && params.end_time <= rule.endTime) {
                    pricePerHour = rule.pricePerHour;
                    break;
                }
            } else {
                pricePerHour = rule.pricePerHour;
            }
        }

        const [startH, startM] = params.start_time.split(':').map(Number);
        const [endH, endM] = params.end_time.split(':').map(Number);
        const durationHours = (endH * 60 + endM - startH * 60 - startM) / 60;
        const totalAmount = pricePerHour * durationHours;

        // Tạo booking
        const booking = await prisma.booking.create({
            data: {
                courtId: params.court_id,
                customerId: customer?.id,
                date: bookingDate,
                startTime: params.start_time,
                endTime: params.end_time,
                status: 'CONFIRMED',
                totalAmount,
                notes: params.notes,
                isRecurring: false,
            },
            include: {
                court: { select: { name: true } },
                customer: { select: { name: true, phone: true } },
            },
        });

        return JSON.stringify({
            success: true,
            booking_id: booking.id,
            message: `✅ Đặt sân thành công!`,
            details: {
                court: booking.court.name,
                customer: booking.customer?.name || params.customer_name || 'Khách lẻ',
                date: format(new Date(booking.date), 'dd/MM/yyyy'),
                time: `${booking.startTime} - ${booking.endTime}`,
                amount: `${booking.totalAmount.toLocaleString('vi-VN')}đ`,
                status: 'Đã xác nhận',
            },
        });
    } catch (error: any) {
        return `Lỗi khi tạo booking: ${error.message}`;
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

## QUY TRÌNH ĐẶT SÂN (hướng dẫn từng bước):
1. Hỏi khách muốn đặt ngày nào, giờ nào
2. Kiểm tra lịch trống (gọi check_availability)
3. Xác nhận sân khả dụng với khách
4. Hỏi số điện thoại khách hàng
5. Tìm thông tin khách (gọi find_customer_by_phone)
6. Nếu khách mới: hỏi thêm tên
7. Xác nhận lại toàn bộ thông tin với khách
8. Tạo booking (gọi create_booking)
9. Thông báo xác nhận booking thành công

## LƯU Ý QUAN TRỌNG:
- KHÔNG tự ý tạo booking mà chưa xác nhận với khách
- Luôn kiểm tra lịch trống trước khi đề xuất
- Khi hỏi ngày: nếu khách nói "hôm nay", "ngày mai", hãy tính theo ngày hiện tại ${format(new Date(), 'dd/MM/yyyy')}
- Giờ hoạt động thường là 06:00 - 23:00

Hôm nay là: ${format(new Date(), 'EEEE, dd/MM/yyyy')}.`;

// ============================================================
// HÀM CHÍNH: Xử lý cuộc hội thoại
// ============================================================
export async function processChat(
    userMessage: string,
    history: ChatMessage[]
): Promise<{ reply: string; updatedHistory: ChatMessage[] }> {
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
    let response = await chat.sendMessage(userMessage);
    let responseText = response.response.text();

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
            const result = await executeTool(fc.name, fc.args as Record<string, any>);
            systemToolResult += `[Kết quả từ hàm ${fc.name}]:\n${result}\n\n`;
        }
        systemToolResult += "Dựa vào kết quả trên, hãy trả lời câu hỏi của người dùng.";

        // Gửi text thay vì object functionResponse để tránh lỗi "Role 'function' is not supported" của model mới
        response = await chat.sendMessage(systemToolResult);
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

    return { reply: responseText, updatedHistory: trimmedHistory };
}
