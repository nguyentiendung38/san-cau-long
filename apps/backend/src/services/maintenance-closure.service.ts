import prisma from '../config/database.js';
import { AppError } from '../middleware/error.js';

export function bookingInterval(date: Date, startTime: string, endTime: string) {
    const day = new Date(date);
    return {
        startAt: new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), ...startTime.split(':').map(Number))),
        endAt: new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), ...endTime.split(':').map(Number))),
    };
}

export function intervalsOverlap(
    firstStart: Date,
    firstEnd: Date,
    secondStart: Date,
    secondEnd: Date,
) {
    return firstStart < secondEnd && secondStart < firstEnd;
}

export class MaintenanceClosureService {
    async ensureAvailable(courtId: string, date: Date, startTime: string, endTime: string) {
        const interval = bookingInterval(date, startTime, endTime);
        const closure = await prisma.maintenanceClosure.findFirst({
            where: {
                courtId,
                startAt: { lt: interval.endAt },
                endAt: { gt: interval.startAt },
            },
            include: { court: { select: { name: true } } },
        });
        if (closure) {
            throw new AppError(409, `Sân ${closure.court.name} đang đóng bảo trì trong khung giờ này`);
        }
    }

    async list(venueId: string, startAt?: Date, endAt?: Date) {
        return prisma.maintenanceClosure.findMany({
            where: {
                court: { venueId },
                ...(startAt || endAt ? {
                    startAt: { ...(endAt ? { lt: endAt } : {}) },
                    endAt: { ...(startAt ? { gt: startAt } : {}) },
                } : {}),
            },
            include: { court: { select: { id: true, name: true } } },
            orderBy: { startAt: 'asc' },
        });
    }

    async create(input: { courtId: string; startAt: string; endAt: string; reason?: string }) {
        const startAt = new Date(input.startAt);
        const endAt = new Date(input.endAt);
        if (
            !Number.isFinite(startAt.getTime()) ||
            !Number.isFinite(endAt.getTime()) ||
            startAt >= endAt ||
            (input.reason !== undefined && (typeof input.reason !== 'string' || input.reason.trim().length > 250))
        ) {
            throw new AppError(400, 'Khoảng thời gian bảo trì không hợp lệ');
        }
        const court = await prisma.court.findUnique({
            where: { id: input.courtId },
            select: { id: true, venueId: true, name: true },
        });
        if (!court) throw new AppError(404, 'Không tìm thấy sân');

        const startDay = new Date(Date.UTC(startAt.getUTCFullYear(), startAt.getUTCMonth(), startAt.getUTCDate()));
        const endDay = new Date(Date.UTC(endAt.getUTCFullYear(), endAt.getUTCMonth(), endAt.getUTCDate()));
        const [bookings, requests] = await Promise.all([
            prisma.booking.findMany({
                where: { courtId: input.courtId, date: { gte: startDay, lte: endDay }, status: { notIn: ['CANCELLED', 'COMPLETED'] } },
                select: { date: true, startTime: true, endTime: true },
            }),
            prisma.bookingRequest.findMany({
                where: {
                    courtId: input.courtId,
                    date: { gte: startDay, lte: endDay },
                    status: 'PENDING',
                    paymentStatus: { not: 'FAILED' },
                    OR: [
                        { paymentMethod: 'DEPOSIT_TRANSFER', expiresAt: { gt: new Date() } },
                        { paymentMethod: 'VNPAY', createdAt: { gte: new Date(Date.now() - 15 * 60_000) } },
                        { paymentMethod: { notIn: ['DEPOSIT_TRANSFER', 'VNPAY'] } },
                    ],
                },
                select: { date: true, startTime: true, endTime: true },
            }),
        ]);
        const conflicts = [...bookings, ...requests].some((reservation) => {
            const interval = bookingInterval(reservation.date, reservation.startTime, reservation.endTime);
            return intervalsOverlap(interval.startAt, interval.endAt, startAt, endAt);
        });
        if (conflicts) throw new AppError(409, 'Không thể đóng sân vì khung giờ đã có lịch đặt hoặc yêu cầu đang chờ');

        return prisma.maintenanceClosure.create({
            data: {
                courtId: court.id,
                startAt,
                endAt,
                reason: input.reason?.trim() || null,
            },
            include: { court: { select: { id: true, name: true } } },
        });
    }

    async delete(id: string) {
        const existing = await prisma.maintenanceClosure.findUnique({ where: { id } });
        if (!existing) throw new AppError(404, 'Không tìm thấy lịch đóng bảo trì');
        await prisma.maintenanceClosure.delete({ where: { id } });
    }
}

export const maintenanceClosureService = new MaintenanceClosureService();
