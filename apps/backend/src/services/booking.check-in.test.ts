import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
    prismaMock: {
        booking: { findUnique: vi.fn(), updateMany: vi.fn() },
        venueStaff: { findUnique: vi.fn() },
    },
}));

vi.mock('../config/database.js', () => ({ default: prismaMock }));

import { BookingService } from './booking.service.js';

describe('booking QR check-in', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('requires the staff user to be assigned to the booking venue', async () => {
        prismaMock.booking.findUnique.mockResolvedValue({
            id: 'booking-1',
            status: 'CONFIRMED',
            checkedInAt: null,
            court: { venueId: 'venue-1' },
        });
        prismaMock.venueStaff.findUnique.mockResolvedValue(null);

        await expect(new BookingService().checkIn('booking-1', 'staff-1', 'STAFF'))
            .rejects.toMatchObject({ statusCode: 403 });
        expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
    });

    it('uses an atomic confirmed-and-not-checked-in guard to reject duplicate scans', async () => {
        prismaMock.booking.findUnique.mockResolvedValue({
            id: 'booking-1',
            status: 'CONFIRMED',
            checkedInAt: null,
            court: { venueId: 'venue-1' },
        });
        prismaMock.venueStaff.findUnique.mockResolvedValue({ id: 'assignment-1' });
        prismaMock.booking.updateMany.mockResolvedValue({ count: 0 });

        await expect(new BookingService().checkIn('booking-1', 'staff-1', 'STAFF'))
            .rejects.toMatchObject({ statusCode: 409 });
        expect(prismaMock.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'booking-1', status: 'CONFIRMED', checkedInAt: null },
        }));
    });

    it('rejects malformed QR tokens before database lookup', async () => {
        await expect(new BookingService().checkInByToken('short', 'staff-1', 'STAFF'))
            .rejects.toMatchObject({ statusCode: 400 });
        expect(prismaMock.booking.findUnique).not.toHaveBeenCalled();
    });
});
