import prisma from '../config/database.js';
import { AppError } from '../middleware/error.js';

export type VenueReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CreateVenueReviewInput {
    venueId: string;
    customerName: string;
    customerPhone: string;
    rating: number;
    content: string;
    images?: string[];
}

function formatReview<T extends { images: string | null }>(review: T) {
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
    return { ...review, images };
}

export class VenueReviewService {
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
        const venue = await prisma.venue.findUnique({
            where: { id: input.venueId },
            select: { id: true },
        });
        if (!venue) {
            throw new AppError(404, 'Không tìm thấy cơ sở');
        }

        const review = await prisma.venueReview.create({
            data: {
                venueId: input.venueId,
                customerName: input.customerName.trim(),
                customerPhone: input.customerPhone.trim(),
                rating: input.rating,
                content: input.content.trim(),
                images: input.images?.length ? JSON.stringify(input.images) : null,
            },
        });
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
