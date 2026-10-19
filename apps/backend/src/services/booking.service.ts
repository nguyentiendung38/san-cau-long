import prisma from '../config/database.js';
import { AppError } from '../middleware/error.js';
import { isWithinOperatingHours, timeToMinutes } from '../utils/booking-rules.js';
import { parseBookingOrder, serializeBookingOrder } from '../utils/booking-order.js';
import { voucherService } from './voucher.service.js';
import { maintenanceClosureService, bookingInterval } from './maintenance-closure.service.js';
import { notificationService, safelyQueueNotification } from './notification.service.js';
import { randomBytes } from 'node:crypto';

function withoutCheckInToken<T extends { checkInToken?: string | null }>(booking: T) {
    const { checkInToken: _checkInToken, ...safeBooking } = booking;
    return safeBooking;
}

export interface PricingRuleForCalculation {
    name: string;
    dayOfWeek: string | null;
    startTime: string | null;
    endTime: string | null;
    pricePerHour: number;
    priority: number;
}

export function calculatePriceFromRules(
    pricingRules: PricingRuleForCalculation[],
    dayOfWeek: string,
    startTime: string,
    endTime: string
) {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    const duration = (endMinutes - startMinutes) / 60;
    let total = 0;
    const appliedRules = new Set<string>();
    let hasUnpricedSlot = false;

    const sortedRules = [...pricingRules].sort((a, b) =>
        b.priority - a.priority || a.name.localeCompare(b.name),
    );
    for (let slotStart = startMinutes; slotStart < endMinutes;) {
        const slotEnd = Math.min(endMinutes, (Math.floor(slotStart / 30) + 1) * 30);
        const slotStartTime = `${String(Math.floor(slotStart / 60)).padStart(2, '0')}:${String(slotStart % 60).padStart(2, '0')}`;
        const slotEndTime = `${String(Math.floor(slotEnd / 60)).padStart(2, '0')}:${String(slotEnd % 60).padStart(2, '0')}`;
        const matchingRule = sortedRules.find((rule) => {
            if (rule.dayOfWeek && rule.dayOfWeek !== dayOfWeek) return false;
            return (!rule.startTime || rule.startTime <= slotStartTime) &&
                (!rule.endTime || rule.endTime >= slotEndTime);
        });

        if (matchingRule) {
            const slotDuration = (slotEnd - slotStart) / 60;
            total += matchingRule.pricePerHour * slotDuration;
            appliedRules.add(matchingRule.name);
        } else {
            hasUnpricedSlot = true;
        }
        slotStart = slotEnd;
    }

    return {
        pricePerHour: duration > 0 && !hasUnpricedSlot ? total / duration : 0,
        duration,
        total: hasUnpricedSlot ? 0 : total,
        appliedRule: hasUnpricedSlot
            ? 'Chưa thiết lập giá cho toàn bộ khung giờ'
            : appliedRules.size > 0
                ? [...appliedRules].join(', ')
                : 'Chưa thiết lập giá',
    };
}

export interface CreateBookingInput {
    courtId: string;
    customerId?: string;
    date: Date;
    startTime: string;
    endTime: string;
    notes?: string;
    voucherCode?: string;
    discountAmount?: number;
    createdById?: string;
    orderedItems?: string | null;
    paymentMethod?: string;
    paymentStatus?: string;
    paymentAmount?: number;
    paymentProof?: string;
}

export interface UpdateBookingInput {
    startTime?: string;
    endTime?: string;
    notes?: string;
    voucherCode?: string;
    discountAmount?: number;
    status?: string;
}

export interface BookingQueryParams {
    courtId?: string;
    customerId?: string;
    venueId?: string;
    date?: Date;
    startDate?: Date;
    endDate?: Date;
    status?: string;
    page?: number;
    limit?: number;
}

export class BookingService {
    private async ensureNoPendingRequestConflict(
        courtId: string,
        date: Date,
        startTime: string,
        endTime: string,
        excludeRequestId?: string,
    ) {
        const startOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
        const requests = await prisma.bookingRequest.findMany({
            where: {
                courtId,
                date: { gte: startOfDay, lte: endOfDay },
                status: 'PENDING',
                OR: [
                    { paymentMethod: 'DEPOSIT_TRANSFER', expiresAt: { gt: new Date() } },
                    { paymentMethod: 'VNPAY', createdAt: { gte: new Date(Date.now() - 15 * 60_000) } },
                    { paymentMethod: { notIn: ['DEPOSIT_TRANSFER', 'VNPAY'] } },
                ],
                ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
            },
            select: { startTime: true, endTime: true, paymentStatus: true },
        });
        const activeRequests = requests.filter((request) => request.paymentStatus !== 'FAILED');
        if (activeRequests.some((request) => startTime < request.endTime && request.startTime < endTime)) {
            throw new AppError(409, 'Khung giờ này đang có yêu cầu đặt sân chờ xử lý');
        }
    }

    // Check if time slot is available
    async checkAvailability(
        courtId: string,
        date: Date,
        startTime: string,
        endTime: string,
        excludeBookingId?: string
    ): Promise<{ available: boolean; conflicts: any[] }> {
        const startOfDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

        const where: any = {
            courtId,
            date: {
                gte: startOfDay,
                lte: endOfDay,
            },
            status: {
                in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'],
            },
        };

        if (excludeBookingId) {
            where.id = { not: excludeBookingId };
        }

        const existingBookings = await prisma.booking.findMany({
            where,
            select: {
                id: true,
                startTime: true,
                endTime: true,
                status: true,
                customer: { select: { name: true } },
            },
        });

        // Check for time overlaps
        interface BookingSlot {
            id: string;
            startTime: string;
            endTime: string;
            status: string;
            customer: { name: string } | null;
        }
        const conflicts = existingBookings.filter((booking: BookingSlot) => {
            // Convert times to minutes for easier comparison
            const [bStartH, bStartM] = booking.startTime.split(':').map(Number);
            const [bEndH, bEndM] = booking.endTime.split(':').map(Number);
            const [startH, startM] = startTime.split(':').map(Number);
            const [endH, endM] = endTime.split(':').map(Number);

            const bStart = bStartH * 60 + bStartM;
            const bEnd = bEndH * 60 + bEndM;
            const start = startH * 60 + startM;
            const end = endH * 60 + endM;

            // Overlap if: start < existingEnd AND end > existingStart
            return start < bEnd && end > bStart;
        });
        const interval = bookingInterval(date, startTime, endTime);
        const closures = await prisma.maintenanceClosure.findMany({
            where: {
                courtId,
                startAt: { lt: interval.endAt },
                endAt: { gt: interval.startAt },
            },
            select: { id: true, startAt: true, endAt: true, reason: true },
        });
        conflicts.push(...closures.map((closure) => ({
            id: closure.id,
            startTime: closure.startAt.toISOString(),
            endTime: closure.endAt.toISOString(),
            status: 'MAINTENANCE',
            customer: null,
        })));

        return {
            available: conflicts.length === 0,
            conflicts,
        };
    }

    // Calculate price for booking
    async calculatePrice(
        courtId: string,
        date: Date,
        startTime: string,
        endTime: string
    ): Promise<{ pricePerHour: number; duration: number; total: number; appliedRule?: string }> {
        // Get court and venue
        const court = await prisma.court.findUnique({
            where: { id: courtId },
            include: { venue: true },
        });

        if (!court) {
            throw new AppError(404, 'Không tìm thấy sân');
        }

        if (endTime <= startTime) {
            throw new AppError(400, 'Thời gian kết thúc phải sau thời gian bắt đầu');
        }

        const dayOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][
            date.getUTCDay()
        ];
        const pricingRules = await prisma.pricingRule.findMany({
            where: { venueId: court.venueId, isActive: true },
            orderBy: { priority: 'desc' },
        });
        return calculatePriceFromRules(pricingRules, dayOfWeek, startTime, endTime);
    }

    async findAll(params: BookingQueryParams) {
        const { courtId, customerId, venueId, date, startDate, endDate, status, page = 1, limit = 50 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (courtId) where.courtId = courtId;
        if (customerId) where.customerId = customerId;
        if (status) where.status = status;

        if (venueId) {
            where.court = { venueId };
        }

        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            where.date = { gte: startOfDay, lte: endOfDay };
        } else if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(startDate);
            if (endDate) where.date.lte = new Date(endDate);
        }

        const [bookings, total] = await Promise.all([
            prisma.booking.findMany({
                where,
                include: {
                    court: {
                        select: { id: true, name: true, venue: { select: { id: true, name: true } } },
                    },
                    customer: {
                        select: { id: true, name: true, phone: true, membershipTier: true },
                    },
                    createdBy: {
                        select: { id: true, name: true },
                    },
                },
                skip,
                take: limit,
                orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
            }),
            prisma.booking.count({ where }),
        ]);

        return {
            data: bookings.map(({ checkInToken: _checkInToken, ...booking }) => booking),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async findById(id: string) {
        const booking = await prisma.booking.findUnique({
            where: { id },
            include: {
                court: {
                    include: { venue: true },
                },
                customer: true,
                createdBy: {
                    select: { id: true, name: true, email: true },
                },
                invoiceItem: {
                    include: { invoice: true },
                },
            },
        });

        if (!booking) {
            throw new AppError(404, 'Không tìm thấy lịch đặt sân');
        }

        const { checkInToken: _checkInToken, ...safeBooking } = booking;
        return safeBooking;
    }

    async getCheckInToken(id: string, userId?: string, role?: string) {
        const booking = await prisma.booking.findUnique({
            where: { id },
            include: { court: { select: { venueId: true } } },
        });
        if (!booking) throw new AppError(404, 'Không tìm thấy lịch đặt sân');
        if (role !== 'SUPER_ADMIN' && role !== 'ADMIN' && role !== 'MANAGER') {
            const assignment = userId ? await prisma.venueStaff.findUnique({
                where: { userId_venueId: { userId, venueId: booking.court.venueId } },
                select: { id: true },
            }) : null;
            if (!assignment) throw new AppError(403, 'Bạn không có quyền xem mã QR tại cơ sở này');
        }
        if (booking.status !== 'CONFIRMED' || booking.checkedInAt) {
            throw new AppError(409, 'Mã QR chỉ hiển thị cho lịch đã xác nhận chưa check-in');
        }
        let token = booking.checkInToken;
        if (!token) {
            token = randomBytes(32).toString('base64url');
            await prisma.booking.updateMany({
                where: { id, checkInToken: null, status: 'CONFIRMED', checkedInAt: null },
                data: { checkInToken: token },
            });
            const updated = await prisma.booking.findUnique({ where: { id }, select: { checkInToken: true } });
            token = updated?.checkInToken || null;
        }
        if (!token) throw new AppError(409, 'Không thể cấp mã QR cho lịch này');
        return { bookingId: id, token };
    }

    async create(
        input: CreateBookingInput,
        options: { totalAmountOverride?: number; bookingRequestId?: string } = {},
    ) {
        // Check court exists and is active
        const court = await prisma.court.findUnique({
            where: { id: input.courtId },
            include: { venue: true },
        });

        if (!court) {
            throw new AppError(404, 'Không tìm thấy sân');
        }

        if (court.status !== 'ACTIVE') {
            throw new AppError(400, 'Sân hiện không hoạt động');
        }
        if (!court.venue.isActive) {
            throw new AppError(400, 'Cơ sở hiện không nhận đặt sân');
        }

        const startMinutes = timeToMinutes(input.startTime);
        const endMinutes = timeToMinutes(input.endTime);
        if (
            startMinutes === null ||
            endMinutes === null ||
            startMinutes >= endMinutes ||
            startMinutes % 30 !== 0 ||
            endMinutes % 30 !== 0
        ) {
            throw new AppError(400, 'Khung giờ đặt phải hợp lệ và theo khoảng 30 phút');
        }
        await maintenanceClosureService.ensureAvailable(input.courtId, input.date, input.startTime, input.endTime);

        // Check availability
        const { available, conflicts } = await this.checkAvailability(
            input.courtId,
            input.date,
            input.startTime,
            input.endTime
        );

        if (!available) {
            throw new AppError(409, 'Khung giờ này đã có người đặt', { conflicts });
        }

        
        const dateObj = new Date(input.date);
        if (Number.isNaN(dateObj.getTime())) {
            throw new AppError(400, 'Ngày đặt sân không hợp lệ');
        }
        const dayNum = dateObj.getUTCDay();
        const operatingHours = await prisma.operatingHour.findMany({
            where: { venueId: court.venueId, isActive: true }
        });
        if (!isWithinOperatingHours(operatingHours, dayNum, input.startTime, input.endTime)) {
            throw new AppError(400, 'Cơ sở không hoạt động trong khung giờ bạn chọn.');
        }

        await this.ensureNoPendingRequestConflict(
            input.courtId,
            dateObj,
            input.startTime,
            input.endTime,
            options.bookingRequestId,
        );

        // Calculate price
        const pricing = await this.calculatePrice(
            input.courtId,
            new Date(input.date),
            input.startTime,
            input.endTime
        );
        
        if (pricing.total <= 0 || pricing.appliedRule?.startsWith('Chưa thiết lập giá')) {
            throw new AppError(400, 'Khung giờ này ngoài giờ hoạt động (chưa thiết lập giá)');
        }

        const order = parseBookingOrder(input.orderedItems);
        const itemsTotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const subtotal = pricing.total + itemsTotal;
        let discountAmount = input.discountAmount ?? order.discountAmount;
        if (input.voucherCode && input.discountAmount === undefined && order.discountAmount === 0) {
            discountAmount = (await voucherService.validate(input.voucherCode, subtotal)).discountAmount;
        }
        if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > subtotal) {
            throw new AppError(400, 'Mức giảm giá không hợp lệ');
        }
        const finalTotalAmount = options.totalAmountOverride ?? Math.max(0, subtotal - discountAmount);
        if (!Number.isFinite(finalTotalAmount) || finalTotalAmount < 0) {
            throw new AppError(400, 'Tổng tiền lịch đặt không hợp lệ');
        }
        const storedOrder = serializeBookingOrder(
            order.items,
            discountAmount,
            input.voucherCode ?? order.voucherCode,
        );

        let booking;
        try {
            booking = await prisma.booking.create({
                data: {
                    courtId: input.courtId,
                    customerId: input.customerId,
                    createdById: input.createdById,
                    date: input.date,
                    startTime: input.startTime,
                    endTime: input.endTime,
                    totalAmount: finalTotalAmount,
                    notes: input.notes,
                    orderedItems: storedOrder,
                    paymentMethod: input.paymentMethod || 'DEPOSIT_TRANSFER',
                    paymentStatus: input.paymentStatus || 'PENDING',
                    paymentAmount: input.paymentAmount,
                    paymentProof: input.paymentProof,
                    status: 'CONFIRMED',
                    checkInToken: randomBytes(32).toString('base64url'),
                },
                include: {
                    court: { select: { name: true, venueId: true } },
                    customer: { select: { name: true, phone: true } },
                },
            });
            if (input.voucherCode) await voucherService.consume(input.voucherCode);
        } catch (error) {
            if (booking) {
                await prisma.booking.delete({ where: { id: booking.id } });
            }
            throw error;
        }
        if (booking) await safelyQueueNotification(notificationService.upcomingBooking(booking), 'nhắc lịch');

        // Update customer stats if linked
        if (input.customerId) {
            await prisma.customer.update({
                where: { id: input.customerId },
                data: { totalBookings: { increment: 1 } },
            });
        }

        return { booking: withoutCheckInToken(booking), pricing };
    }

    async update(id: string, input: UpdateBookingInput) {
        const existing = await prisma.booking.findUnique({ where: { id } });
        if (!existing) {
            throw new AppError(404, 'Không tìm thấy lịch đặt sân');
        }

        const updateData: {
            startTime?: string;
            endTime?: string;
            notes?: string;
            status?: string;
            totalAmount?: number;
        } = {};
        if (input.notes !== undefined) updateData.notes = input.notes;
        if (input.status !== undefined) updateData.status = input.status;

        if (input.startTime || input.endTime) {
            const startTime = input.startTime || existing.startTime;
            const endTime = input.endTime || existing.endTime;
            const startMinutes = timeToMinutes(startTime);
            const endMinutes = timeToMinutes(endTime);
            if (
                startMinutes === null ||
                endMinutes === null ||
                startMinutes >= endMinutes ||
                startMinutes % 30 !== 0 ||
                endMinutes % 30 !== 0
            ) {
                throw new AppError(400, 'Khung giờ đặt phải hợp lệ và theo khoảng 30 phút');
            }

            const { available, conflicts } = await this.checkAvailability(
                existing.courtId,
                existing.date,
                startTime,
                endTime,
                id
            );

            if (!available) {
                throw new AppError(409, 'Khung giờ này đã có người đặt', { conflicts });
            }
            await this.ensureNoPendingRequestConflict(existing.courtId, existing.date, startTime, endTime);

            const court = await prisma.court.findUnique({
                where: { id: existing.courtId },
                select: { venueId: true },
            });
            if (!court) throw new AppError(404, 'Không tìm thấy sân');
            const operatingHours = await prisma.operatingHour.findMany({
                where: { venueId: court.venueId, isActive: true },
            });
            if (!isWithinOperatingHours(operatingHours, existing.date.getUTCDay(), startTime, endTime)) {
                throw new AppError(400, 'Cơ sở không hoạt động trong khung giờ bạn chọn.');
            }

            const pricing = await this.calculatePrice(existing.courtId, existing.date, startTime, endTime);
            const order = parseBookingOrder(existing.orderedItems);
            const itemsTotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            updateData.startTime = startTime;
            updateData.endTime = endTime;
            updateData.totalAmount = Math.max(0, pricing.total + itemsTotal - order.discountAmount);
        }

        const booking = await prisma.booking.update({
            where: { id },
            data: updateData,
            include: {
                court: { select: { name: true } },
                customer: { select: { name: true, phone: true } },
            },
        });

        return withoutCheckInToken(booking);
    }

    async cancel(id: string, reason?: string) {
        const existing = await prisma.booking.findUnique({ where: { id } });
        if (!existing) {
            throw new AppError(404, 'Không tìm thấy lịch đặt sân');
        }

        if (existing.status === 'CANCELLED') {
            throw new AppError(400, 'Lịch đặt đã bị hủy trước đó');
        }

        if (existing.status === 'COMPLETED') {
            throw new AppError(400, 'Không thể hủy lịch đã hoàn thành');
        }

        const booking = await prisma.booking.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                notes: reason ? `${existing.notes || ''}\n[Hủy]: ${reason}` : existing.notes,
            },
        });

        // Auto-cancel associated BookingRequest so the customer sees it in their history
        if (existing.customerId) {
            const customer = await prisma.customer.findUnique({ where: { id: existing.customerId } });
            if (customer) {
                const requests = await prisma.bookingRequest.findMany({
                    where: {
                        courtId: existing.courtId,
                        date: existing.date,
                        startTime: existing.startTime,
                        endTime: existing.endTime,
                        phone: customer.phone,
                        status: 'APPROVED'
                    }
                });
                
                for (const req of requests) {
                    await prisma.bookingRequest.update({
                        where: { id: req.id },
                        data: { 
                            status: 'REJECTED',
                            notes: req.notes ? req.notes + '\\n[Hủy bởi Admin]' : '[Hủy bởi Admin]'
                        }
                    });
                }
            }
        }

        return withoutCheckInToken(booking);
    }

    async checkIn(id: string, userId?: string, role?: string) {
        const existing = await prisma.booking.findUnique({
            where: { id },
            include: { court: { select: { venueId: true } } },
        });
        if (!existing) {
            throw new AppError(404, 'Không tìm thấy lịch đặt sân');
        }

        if (role !== 'SUPER_ADMIN' && role !== 'ADMIN' && role !== 'MANAGER') {
            const assignment = userId ? await prisma.venueStaff.findUnique({
                where: { userId_venueId: { userId, venueId: existing.court.venueId } },
                select: { id: true },
            }) : null;
            if (!assignment) throw new AppError(403, 'Bạn không có quyền check-in tại cơ sở này');
        }
        if (existing.status !== 'CONFIRMED') {
            throw new AppError(400, 'Chỉ có thể check-in lịch đã xác nhận');
        }

        const result = await prisma.booking.updateMany({
            where: { id, status: 'CONFIRMED', checkedInAt: null },
            data: {
                status: 'IN_PROGRESS',
                checkedInAt: new Date(),
                checkedInById: userId || null,
            },
        });
        if (result.count !== 1) throw new AppError(409, 'Lịch này đã được check-in hoặc không còn hợp lệ');
        const booking = await prisma.booking.findUnique({ where: { id } });
        if (!booking) throw new AppError(404, 'Không tìm thấy lịch đặt sân');
        return withoutCheckInToken(booking);
    }

    async checkInByToken(token: string, userId?: string, role?: string) {
        if (!token || token.length < 32 || token.length > 100) {
            throw new AppError(400, 'Mã QR không hợp lệ');
        }
        const booking = await prisma.booking.findUnique({ where: { checkInToken: token }, select: { id: true } });
        if (!booking) throw new AppError(404, 'Không tìm thấy lịch đặt cho mã QR này');
        return this.checkIn(booking.id, userId, role);
    }

    async markNoShow(id: string, userId?: string, role?: string) {
        const existing = await prisma.booking.findUnique({
            where: { id },
            include: { court: { select: { venueId: true } } },
        });
        if (!existing) {
            throw new AppError(404, 'Không tìm thấy lịch đặt sân');
        }

        if (role !== 'SUPER_ADMIN' && role !== 'ADMIN' && role !== 'MANAGER') {
            const assignment = userId ? await prisma.venueStaff.findUnique({
                where: { userId_venueId: { userId, venueId: existing.court.venueId } },
                select: { id: true },
            }) : null;
            if (!assignment) throw new AppError(403, 'Bạn không có quyền cập nhật lịch tại cơ sở này');
        }
        if (existing.status !== 'CONFIRMED' || existing.checkedInAt) {
            throw new AppError(409, 'Chỉ lịch đã xác nhận và chưa check-in mới có thể ghi nhận vắng');
        }

        const endMinutes = timeToMinutes(existing.endTime);
        if (endMinutes === null) {
            throw new AppError(400, 'Giờ kết thúc lịch đặt không hợp lệ');
        }
        const bookingEnd = new Date(Date.UTC(
            existing.date.getUTCFullYear(),
            existing.date.getUTCMonth(),
            existing.date.getUTCDate(),
            Math.floor(endMinutes / 60),
            endMinutes % 60,
        ));
        if (bookingEnd > new Date()) {
            throw new AppError(400, 'Chỉ có thể ghi nhận khách vắng sau khi hết giờ đặt sân');
        }

        const result = await prisma.booking.updateMany({
            where: { id, status: 'CONFIRMED', checkedInAt: null },
            data: { status: 'NO_SHOW' },
        });
        if (result.count !== 1) {
            throw new AppError(409, 'Lịch này đã được cập nhật hoặc không còn hợp lệ');
        }

        const booking = await prisma.booking.findUnique({ where: { id } });
        if (!booking) throw new AppError(404, 'Không tìm thấy lịch đặt sân');
        return withoutCheckInToken(booking);
    }

    async checkOut(id: string) {
        const existing = await prisma.booking.findUnique({ where: { id } });
        if (!existing) {
            throw new AppError(404, 'Không tìm thấy lịch đặt sân');
        }

        if (existing.status === 'COMPLETED') {
            return withoutCheckInToken(existing); // Already checked out, return gracefully
        }

        if (existing.status !== 'IN_PROGRESS' && existing.status !== 'CONFIRMED') {
            throw new AppError(400, 'Chỉ có thể check-out lịch đang diễn ra hoặc đã xác nhận');
        }

        const booking = await prisma.booking.update({
            where: { id },
            data: {
                status: 'COMPLETED',
                checkedOutAt: new Date(),
            },
        });

        return withoutCheckInToken(booking);
    }

    // Get bookings for calendar view (by venue and date range)
    async getCalendarData(venueId: string, startDate: Date, endDate: Date) {
        const courts = await prisma.court.findMany({
            where: { venueId, status: 'ACTIVE' },
            orderBy: { sortOrder: 'asc' },
        });

        const courtIds = courts.map((c: { id: string }) => c.id);

        const bookings = await prisma.booking.findMany({
            where: {
                courtId: { in: courtIds },
                date: {
                    gte: startDate,
                    lte: endDate,
                },
                status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
            },
            include: {
                customer: {
                    select: { id: true, name: true, phone: true, membershipTier: true },
                },
                court: {
                    select: { id: true, name: true },
                },
                invoiceItem: {
                    include: { invoice: { select: { paymentStatus: true } } }
                }
            },
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        });

        const maintenanceClosures = await prisma.maintenanceClosure.findMany({
            where: {
                court: { venueId },
                startAt: { lt: new Date(endDate.getTime() + 24 * 60 * 60_000) },
                endAt: { gt: startDate },
            },
            include: { court: { select: { id: true, name: true } } },
            orderBy: { startAt: 'asc' },
        });
        return {
            courts,
            bookings: bookings.map(({ checkInToken: _checkInToken, ...booking }) => booking),
            maintenanceClosures,
        };
    }
}

export const bookingService = new BookingService();
