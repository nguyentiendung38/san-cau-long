import prisma from '../config/database.js';
import { AppError } from '../middleware/error.js';

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

    for (let slotStart = startMinutes; slotStart < endMinutes;) {
        const slotEnd = Math.min(endMinutes, (Math.floor(slotStart / 30) + 1) * 30);
        const slotStartTime = `${String(Math.floor(slotStart / 60)).padStart(2, '0')}:${String(slotStart % 60).padStart(2, '0')}`;
        const slotEndTime = `${String(Math.floor(slotEnd / 60)).padStart(2, '0')}:${String(slotEnd % 60).padStart(2, '0')}`;
        const matchingRule = pricingRules.find((rule) => {
            if (rule.dayOfWeek && rule.dayOfWeek !== dayOfWeek) return false;
            return (!rule.startTime || rule.startTime <= slotStartTime) &&
                (!rule.endTime || rule.endTime >= slotEndTime);
        });

        if (matchingRule) {
            const slotDuration = (slotEnd - slotStart) / 60;
            total += matchingRule.pricePerHour * slotDuration;
            appliedRules.add(matchingRule.name);
        }
        slotStart = slotEnd;
    }

    return {
        pricePerHour: duration > 0 ? total / duration : 0,
        duration,
        total,
        appliedRule: appliedRules.size > 0 ? [...appliedRules].join(', ') : 'Chưa thiết lập giá',
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
    // Check if time slot is available
    async checkAvailability(
        courtId: string,
        date: Date,
        startTime: string,
        endTime: string,
        excludeBookingId?: string
    ): Promise<{ available: boolean; conflicts: any[] }> {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

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
            data: bookings,
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

        return booking;
    }

    async create(input: CreateBookingInput) {
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

        // Validate time within venue hours
        const [venueOpenH] = court.venue.openTime.split(':').map(Number);
        const [venueCloseH] = court.venue.closeTime.split(':').map(Number);
        const [startH] = input.startTime.split(':').map(Number);
        const [endH] = input.endTime.split(':').map(Number);

        if (startH < venueOpenH || endH > venueCloseH) {
            throw new AppError(400, `Sân mở cửa từ ${court.venue.openTime} đến ${court.venue.closeTime}`);
        }

        // Calculate price
        const pricing = await this.calculatePrice(
            input.courtId,
            new Date(input.date),
            input.startTime,
            input.endTime
        );
        
        if (pricing.total === 0 && pricing.appliedRule === 'Chưa thiết lập giá') {
            throw new AppError(400, 'Khung giờ này ngoài giờ hoạt động (chưa thiết lập giá)');
        }

        let finalTotalAmount = pricing.total;
        
        if (input.voucherCode && input.discountAmount) {
            finalTotalAmount = Math.max(0, finalTotalAmount - input.discountAmount);
            input.notes = input.notes ? input.notes + '\nÁp dụng voucher: ' + input.voucherCode + ' (-' + input.discountAmount + 'đ)' : 'Áp dụng voucher: ' + input.voucherCode + ' (-' + input.discountAmount + 'đ)';
            
            // Increment voucher usage
            try {
                await prisma.voucher.update({
                    where: { code: input.voucherCode },
                    data: { usageCount: { increment: 1 } }
                });
            } catch (e) {}
        }

        if (input.orderedItems) {
            try {
                const items = JSON.parse(input.orderedItems);
                if (Array.isArray(items)) {
                    finalTotalAmount += items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
                }
            } catch (e) {
                console.error('Failed to parse ordered items in booking create', e);
            }
        }

        // Create booking
        const booking = await prisma.booking.create({
            data: {
                courtId: input.courtId,
                customerId: input.customerId,
                createdById: input.createdById,
                date: input.date,
                startTime: input.startTime,
                endTime: input.endTime,
                totalAmount: finalTotalAmount,
                notes: input.notes,
                orderedItems: input.orderedItems,
                paymentMethod: input.paymentMethod || 'DEPOSIT_TRANSFER',
                paymentStatus: input.paymentStatus || 'PENDING',
                paymentAmount: input.paymentAmount,
                paymentProof: input.paymentProof,
                status: 'CONFIRMED', // Auto-confirm for staff bookings
            },
            include: {
                court: { select: { name: true } },
                customer: { select: { name: true, phone: true } },
            },
        });

        // Update customer stats if linked
        if (input.customerId) {
            await prisma.customer.update({
                where: { id: input.customerId },
                data: { totalBookings: { increment: 1 } },
            });
        }

        return { booking, pricing };
    }

    async update(id: string, input: UpdateBookingInput) {
        const existing = await prisma.booking.findUnique({ where: { id } });
        if (!existing) {
            throw new AppError(404, 'Không tìm thấy lịch đặt sân');
        }

        // If updating time, check availability
        if (input.startTime || input.endTime) {
            const startTime = input.startTime || existing.startTime;
            const endTime = input.endTime || existing.endTime;

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

            // Recalculate price if time changed
            const pricing = await this.calculatePrice(existing.courtId, existing.date, startTime, endTime);
            input = { ...input, ...{ totalAmount: pricing.total } } as any;
        }

        const booking = await prisma.booking.update({
            where: { id },
            data: input as any,
            include: {
                court: { select: { name: true } },
                customer: { select: { name: true, phone: true } },
            },
        });

        return booking;
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

        return booking;
    }

    async checkIn(id: string) {
        const existing = await prisma.booking.findUnique({ where: { id } });
        if (!existing) {
            throw new AppError(404, 'Không tìm thấy lịch đặt sân');
        }

        if (existing.status !== 'CONFIRMED') {
            throw new AppError(400, 'Chỉ có thể check-in lịch đã xác nhận');
        }

        const booking = await prisma.booking.update({
            where: { id },
            data: {
                status: 'IN_PROGRESS',
                checkedInAt: new Date(),
            },
        });

        return booking;
    }

    async checkOut(id: string) {
        const existing = await prisma.booking.findUnique({ where: { id } });
        if (!existing) {
            throw new AppError(404, 'Không tìm thấy lịch đặt sân');
        }

        if (existing.status === 'COMPLETED') {
            return existing; // Already checked out, return gracefully
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

        // Update customer total spent
        if (existing.customerId) {
            await prisma.customer.update({
                where: { id: existing.customerId },
                data: { totalSpent: { increment: existing.totalAmount } },
            });
        }

        return booking;
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
                status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] },
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

        return { courts, bookings };
    }
}

export const bookingService = new BookingService();
