import prisma from '../config/database.js';
import { AppError } from '../middleware/error.js';

export type VenueReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CreateVenueReviewInput {
    bookingId: string;
    customerId: string;
    rating: number;
    content: string;
    images?: string[];
}

function formatReview<T extends { images: string | null; bookingId?: string | null }>(review: T) {
    let images: string[] = [];
    if (review.images) {
        try {
            const parsed: unknown = JSON.parse(review.images);
            if (Array.isArray(parsed) && parsed.every((image) => typeof image === 'string')) {
                images = parsed;
            }
        } catch {
            images = [];
        }
    }
    const legacy = 'bookingId' in review ? !review.bookingId : undefined;
    return { ...review, images, ...(legacy === undefined ? {} : { isLegacy: legacy }) };
}

export class VenueReviewService {
    async findEligibleBookings(customerId: string) {
        return prisma.booking.findMany({
            where: { customerId, status: 'COMPLETED', review: null },
            select: {
                id: true,
                date: true,
                startTime: true,
                endTime: true,
                court: { select: { id: true, name: true, venue: { select: { id: true, name: true } } } },
            },
            orderBy: { date: 'desc' },
        });
    }

    async findPublicSummaries(venueIds: string[]) {
        if (venueIds.length === 0) {
            return [];
        }

        const summaries = await prisma.venueReview.groupBy({
            by: ['venueId'],
            where: {
                venueId: { in: venueIds },
                status: 'APPROVED',
            },
            _avg: { rating: true },
            _count: { _all: true },
        });

        return summaries.map((summary) => ({
            venueId: summary.venueId,
            ratingAverage: summary._avg.rating,
            reviewCount: summary._count._all,
        }));
    }

    async findPublic(venueId: string) {
        const reviews = await prisma.venueReview.findMany({
            where: { venueId, status: 'APPROVED' },
            select: {
                id: true,
                venueId: true,
                customerName: true,
                rating: true,
                content: true,
                images: true,
                status: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        return reviews.map(formatReview);
    }

    async findAll(status?: VenueReviewStatus) {
        const reviews = await prisma.venueReview.findMany({
            where: status ? { status } : undefined,
            include: { venue: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
        });
        return reviews.map(formatReview);
    }

    async create(input: CreateVenueReviewInput) {
        const booking = await prisma.booking.findFirst({
            where: { id: input.bookingId, customerId: input.customerId, status: 'COMPLETED' },
            include: { customer: { select: { name: true, phone: true } }, court: { select: { venueId: true } } },
        });
        if (!booking || !booking.customer) {
            throw new AppError(403, 'Chỉ khách hàng của lịch đã hoàn thành mới có thể gửi đánh giá');
        }
        if (await prisma.venueReview.findUnique({ where: { bookingId: booking.id }, select: { id: true } })) {
            throw new AppError(409, 'Lịch này đã được đánh giá');
        }
        let review;
        try {
            review = await prisma.venueReview.create({
                data: {
                    bookingId: booking.id,
                    customerId: input.customerId,
                    venueId: booking.court.venueId,
                    customerName: booking.customer.name,
                    customerPhone: booking.customer.phone,
                    rating: input.rating,
                    content: input.content.trim(),
                    images: input.images?.length ? JSON.stringify(input.images) : null,
                    status: 'PENDING',
                },
            });
        } catch (error) {
            if ((error as { code?: string })?.code === 'P2002') {
                throw new AppError(409, 'Lịch này đã được đánh giá');
            }
            throw error;
        }
        return formatReview(review);
    }

    async updateStatus(id: string, status: VenueReviewStatus) {
        const existing = await prisma.venueReview.findUnique({ where: { id } });
        if (!existing) {
            throw new AppError(404, 'Không tìm thấy đánh giá');
        }

        const review = await prisma.venueReview.update({
            where: { id },
            data: { status },
            include: { venue: { select: { id: true, name: true } } },
        });
        return formatReview(review);
    }
}

export const venueReviewService = new VenueReviewService();
