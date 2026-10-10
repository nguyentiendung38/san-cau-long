import prisma from '../config/database.js';
import { AppError } from '../middleware/error.js';

export interface CreateCourtInput {
    venueId: string;
    name: string;
    description?: string;
    surfaceType?: string;
    isIndoor?: boolean;
    status?: string;
    sortOrder?: number;
}

export interface UpdateCourtInput extends Partial<Omit<CreateCourtInput, 'venueId'>> { }

export class CourtService {
    async findByVenue(venueId: string) {
        const courts = await prisma.court.findMany({
            where: { venueId },
            orderBy: { sortOrder: 'asc' },
        });

        return courts;
    }

    async findById(id: string) {
        const court = await prisma.court.findUnique({
            where: { id },
            include: {
                venue: {
                    select: { id: true, name: true },
                },
            },
        });

        if (!court) {
            throw new AppError(404, 'Không tìm thấy sân');
        }

        return court;
    }

    async create(input: CreateCourtInput) {
        // Check venue exists
        const venue = await prisma.venue.findUnique({ where: { id: input.venueId } });
        if (!venue) {
            throw new AppError(404, 'Không tìm thấy cơ sở');
        }

        // Get max sort order
        const maxSort = await prisma.court.findFirst({
            where: { venueId: input.venueId },
            orderBy: { sortOrder: 'desc' },
            select: { sortOrder: true },
        });

        const court = await prisma.court.create({
            data: {
                venueId: input.venueId,
                name: input.name,
                description: input.description,
                surfaceType: input.surfaceType,
                isIndoor: input.isIndoor ?? true,
                status: input.status || 'ACTIVE',
                sortOrder: input.sortOrder ?? (maxSort?.sortOrder || 0) + 1,
            },
        });

        return court;
    }

    async update(id: string, input: UpdateCourtInput) {
        const existing = await prisma.court.findUnique({ where: { id } });
        if (!existing) {
            throw new AppError(404, 'Không tìm thấy sân');
        }

        const court = await prisma.court.update({
            where: { id },
            data: input,
        });

        return court;
    }

    async delete(id: string) {
        const existing = await prisma.court.findUnique({
            where: { id },
        });

        if (!existing) {
            throw new AppError(404, 'Không tìm thấy sân');
        }

        await prisma.$transaction(async (tx) => {
            const bookings = await tx.booking.findMany({
                where: { courtId: id },
                select: { id: true },
            });
            const bookingIds = bookings.map((booking) => booking.id);
            const invoiceItems = await tx.invoiceItem.findMany({
                where: { bookingId: { in: bookingIds } },
                select: { invoiceId: true },
            });
            const invoiceIds = [...new Set(invoiceItems.map((item) => item.invoiceId))];

            if (invoiceIds.length > 0) {
                await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
            }

            await tx.bookingRequest.deleteMany({ where: { courtId: id } });
            await tx.court.delete({ where: { id } });
        });
        
        return { message: 'Đã xóa sân thành công' };
    }

    async reorder(venueId: string, courtIds: string[]) {
        // Update sort order for each court
        await Promise.all(
            courtIds.map((id, index) =>
                prisma.court.updateMany({
                    where: { id, venueId },
                    data: { sortOrder: index + 1 },
                })
            )
        );

        return this.findByVenue(venueId);
    }

    async getAvailability(courtId: string, date: Date) {
        const court = await prisma.court.findUnique({
            where: { id: courtId },
            include: { venue: true },
        });

        if (!court) {
            throw new AppError(404, 'Không tìm thấy sân');
        }

        // Get all bookings for this court on the given date
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const bookings = await prisma.booking.findMany({
            where: {
                courtId,
                date: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
                status: {
                    in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'],
                },
            },
            select: {
                id: true,
                startTime: true,
                endTime: true,
                status: true,
                customer: {
                    select: { name: true, phone: true },
                },
            },
            orderBy: { startTime: 'asc' },
        });

        return {
            court,
            date: startOfDay,
            openTime: court.venue.openTime,
            closeTime: court.venue.closeTime,
            bookings,
        };
    }
}

export const courtService = new CourtService();
