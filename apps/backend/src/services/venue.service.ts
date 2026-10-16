import prisma from '../config/database.js';
import { AppError } from '../middleware/error.js';

export interface CreateVenueInput {
    name: string;
    address: string;
    phone?: string;
    email?: string;
    description?: string;
    termsAndServices?: string;
    bankCode?: string | null;
    bankAccountNumber?: string | null;
    bankAccountName?: string | null;
    logo?: string;
    images?: string[] | string;
    openTime?: string;
    closeTime?: string;
}

export interface UpdateVenueInput extends Partial<CreateVenueInput> {
    isActive?: boolean;
}

function formatVenueResponse(venue: any) {
    if (!venue) return venue;
    let parsedImages: string[] = [];
    if (venue.images) {
        if (Array.isArray(venue.images)) {
            parsedImages = venue.images;
        } else if (typeof venue.images === 'string') {
            try {
                const parsed = JSON.parse(venue.images);
                parsedImages = Array.isArray(parsed) ? parsed : [venue.images];
            } catch {
                parsedImages = venue.images ? [venue.images] : [];
            }
        }
    }
    return {
        ...venue,
        images: parsedImages,
    };
}

export interface VenueQueryParams {
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
}

export class VenueService {
    async findAll(params: VenueQueryParams) {
        const { search, isActive, page = 1, limit = 20 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { address: { contains: search } },
                { phone: { contains: search } },
            ];
        }

        if (isActive !== undefined) {
            where.isActive = isActive;
        }

        const [venues, total] = await Promise.all([
            prisma.venue.findMany({
                where,
                include: {
                    _count: { select: { courts: true, staff: true } }, operatingHours: true,
                    courts: {
                        where: { status: 'ACTIVE' }
                    }
                },
                skip,
                take: limit,
                orderBy: { name: 'asc' },
            }),
            prisma.venue.count({ where }),
        ]);

        const reviewSummaries = venues.length > 0
            ? await prisma.venueReview.groupBy({
                by: ['venueId'],
                where: {
                    venueId: { in: venues.map((venue) => venue.id) },
                    status: 'APPROVED',
                },
                _avg: { rating: true },
                _count: { _all: true },
            })
            : [];
        const reviewSummaryByVenueId = new Map(
            reviewSummaries.map((summary) => [summary.venueId, {
                ratingAverage: summary._avg.rating,
                reviewCount: summary._count._all,
            }]),
        );

        return {
            data: venues.map((venue) => ({
                ...formatVenueResponse(venue),
                ratingAverage: reviewSummaryByVenueId.get(venue.id)?.ratingAverage ?? null,
                reviewCount: reviewSummaryByVenueId.get(venue.id)?.reviewCount ?? 0,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findById(id: string) {
        const venue = await prisma.venue.findUnique({
            where: { id },
            include: {
                courts: {
                    orderBy: { sortOrder: 'asc' },
                },
                pricingRules: {
                    where: { isActive: true },
                    orderBy: { priority: 'desc' },
                },
                services: {
                    where: { isActive: true },
                },
                products: {
                    where: { isActive: true },
                },
                operatingHours: {
                    where: { isActive: true },
                },
                _count: {
                    select: { courts: true, staff: true },
                },
            },
        });

        if (!venue) {
            throw new AppError(404, 'Không tìm thấy cơ sở');
        }

        return formatVenueResponse(venue);
    }

    async create(input: CreateVenueInput) {
        let imagesData: string | null = null;
        if (input.images !== undefined) {
            imagesData = Array.isArray(input.images) ? JSON.stringify(input.images) : (input.images || null);
        }

        const venue = await prisma.venue.create({
            data: {
                name: input.name,
                address: input.address,
                phone: input.phone,
                email: input.email,
                description: input.description,
                termsAndServices: input.termsAndServices,
                bankCode: input.bankCode,
                bankAccountNumber: input.bankAccountNumber,
                bankAccountName: input.bankAccountName,
                logo: input.logo,
                images: imagesData,
                openTime: input.openTime || '06:00',
                closeTime: input.closeTime || '23:00',
            },
        });

        return formatVenueResponse(venue);
    }

    async update(id: string, input: UpdateVenueInput) {
        // Check if venue exists
        const existing = await prisma.venue.findUnique({ where: { id } });
        if (!existing) {
            throw new AppError(404, 'Không tìm thấy cơ sở');
        }

        const data: any = { ...input };
        if (input.images !== undefined) {
            data.images = Array.isArray(input.images) ? JSON.stringify(input.images) : (input.images || null);
        }

        const venue = await prisma.venue.update({
            where: { id },
            data,
        });

        return formatVenueResponse(venue);
    }

    async delete(id: string) {
        const existing = await prisma.venue.findUnique({
            where: { id },
            select: { id: true },
        });

        if (!existing) {
            throw new AppError(404, 'Không tìm thấy cơ sở');
        }

        await prisma.$transaction(async (tx) => {
            const [bookings, services, products] = await Promise.all([
                tx.booking.findMany({
                    where: { court: { venueId: id } },
                    select: { id: true },
                }),
                tx.service.findMany({ where: { venueId: id }, select: { id: true } }),
                tx.product.findMany({ where: { venueId: id }, select: { id: true } }),
            ]);
            const relatedItems = await tx.invoiceItem.findMany({
                where: {
                    OR: [
                        { bookingId: { in: bookings.map((booking) => booking.id) } },
                        { serviceId: { in: services.map((service) => service.id) } },
                        { productId: { in: products.map((product) => product.id) } },
                    ],
                },
                select: { invoiceId: true },
            });
            const invoiceIds = [...new Set(relatedItems.map((item) => item.invoiceId))];

            if (invoiceIds.length > 0) {
                await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
            }

            await tx.bookingRequest.deleteMany({ where: { venueId: id } });
            await tx.venue.delete({ where: { id } });
        });

        return { message: 'Đã xóa cơ sở thành công' };
    }

    async getStats(id: string) {
        const venue = await prisma.venue.findUnique({
            where: { id },
            include: {
                courts: true,
                _count: {
                    select: {
                        courts: true,
                        staff: true,
                    },
                },
            },
        });

        if (!venue) {
            throw new AppError(404, 'Không tìm thấy cơ sở');
        }

        // Get today's bookings
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const courtIds = venue.courts.map((c: { id: string }) => c.id);

        const [todayBookings, totalBookings] = await Promise.all([
            prisma.booking.count({
                where: {
                    courtId: { in: courtIds },
                    date: {
                        gte: today,
                        lt: tomorrow,
                    },
                },
            }),
            prisma.booking.count({
                where: {
                    courtId: { in: courtIds },
                },
            }),
        ]);

        return {
            venue,
            stats: {
                totalCourts: venue._count.courts,
                totalStaff: venue._count.staff,
                todayBookings,
                totalBookings,
            },
        };
    }
}

export const venueService = new VenueService();
