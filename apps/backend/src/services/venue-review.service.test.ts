import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
    prismaMock: {
        booking: { findFirst: vi.fn() },
        venueReview: { findUnique: vi.fn(), create: vi.fn() },
    },
}));

vi.mock('../config/database.js', () => ({ default: prismaMock }));

import { VenueReviewService } from './venue-review.service.js';

describe('verified venue reviews', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('rejects reviews when the booking is not completed and owned by the caller', async () => {
        prismaMock.booking.findFirst.mockResolvedValue(null);

        await expect(new VenueReviewService().create({
            bookingId: 'booking-other',
            customerId: 'customer-1',
            rating: 5,
            content: 'Great court',
        })).rejects.toMatchObject({ statusCode: 403 });
        expect(prismaMock.venueReview.create).not.toHaveBeenCalled();
    });

    it('associates the review venue and customer from the verified booking', async () => {
        prismaMock.booking.findFirst.mockResolvedValue({
            id: 'booking-1',
            customer: { name: 'Customer', phone: '0912345678' },
            court: { venueId: 'venue-from-booking' },
        });
        prismaMock.venueReview.findUnique.mockResolvedValue(null);
        prismaMock.venueReview.create.mockResolvedValue({
            id: 'review-1',
            images: null,
            venueId: 'venue-from-booking',
            customerId: 'customer-1',
            bookingId: 'booking-1',
        });

        await new VenueReviewService().create({
            bookingId: 'booking-1',
            customerId: 'customer-1',
            rating: 5,
            content: 'Great court',
        });
        expect(prismaMock.booking.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'booking-1', customerId: 'customer-1', status: 'COMPLETED' },
        }));
        expect(prismaMock.venueReview.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                venueId: 'venue-from-booking',
                customerId: 'customer-1',
                bookingId: 'booking-1',
                status: 'PENDING',
            }),
        }));
    });

    it('prevents a second review for the same completed booking', async () => {
        prismaMock.booking.findFirst.mockResolvedValue({
            id: 'booking-1',
            customer: { name: 'Customer', phone: '0912345678' },
            court: { venueId: 'venue-1' },
        });
        prismaMock.venueReview.findUnique.mockResolvedValue({ id: 'review-existing' });

        await expect(new VenueReviewService().create({
            bookingId: 'booking-1',
            customerId: 'customer-1',
            rating: 5,
            content: 'Great court',
        })).rejects.toMatchObject({ statusCode: 409 });
        expect(prismaMock.venueReview.create).not.toHaveBeenCalled();
    });

    it('handles concurrent duplicate submissions through the unique booking constraint', async () => {
        prismaMock.booking.findFirst.mockResolvedValue({
            id: 'booking-1',
            customer: { name: 'Customer', phone: '0912345678' },
            court: { venueId: 'venue-1' },
        });
        prismaMock.venueReview.findUnique.mockResolvedValue(null);
        prismaMock.venueReview.create.mockRejectedValue({ code: 'P2002' });

        await expect(new VenueReviewService().create({
            bookingId: 'booking-1',
            customerId: 'customer-1',
            rating: 4,
            content: 'Good',
        })).rejects.toMatchObject({ statusCode: 409 });
    });
});
