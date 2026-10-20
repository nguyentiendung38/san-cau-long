import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
    prismaMock: {
        booking: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
        venueStaff: { findUnique: vi.fn() },
    },
}));

vi.mock('../config/database.js', () => ({ default: prismaMock }));

import { BookingService } from './booking.service.js';

describe('booking QR check-in', () => {
    beforeEach(() => { vi.clearAllMocks(); });
    afterEach(() => { vi.useRealTimers(); });

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

    it('returns only the booking details needed by the QR landing page', async () => {
        const booking = {
            id: 'booking-1',
            date: new Date('2026-10-20T00:00:00.000Z'),
            startTime: '14:00',
            endTime: '15:00',
            status: 'CONFIRMED',
            checkedInAt: null,
            totalAmount: 120000,
            paymentStatus: 'PAID',
            court: { name: 'Sân 1', venue: { name: 'Cơ sở A', address: 'Địa chỉ A' } },
        };
        prismaMock.booking.findUnique.mockResolvedValue(booking);

        await expect(new BookingService().getCheckInInfo('a'.repeat(43))).resolves.toEqual({
            bookingId: booking.id,
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            status: booking.status,
            checkedInAt: null,
            totalAmount: booking.totalAmount,
            paymentStatus: booking.paymentStatus,
            courtName: 'Sân 1',
            venueName: 'Cơ sở A',
            venueAddress: 'Địa chỉ A',
        });
    });

    it('automatically marks confirmed bookings as no-show after end time only when not checked in', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(Date.UTC(2026, 9, 19, 5, 0)));
        const date = new Date(Date.UTC(2026, 9, 19));
        prismaMock.booking.findMany.mockResolvedValue([
            { id: 'expired', date, endTime: '11:59' },
            { id: 'still-booked', date, endTime: '12:01' },
            { id: 'invalid-time', date, endTime: 'bad' },
        ]);
        prismaMock.booking.updateMany.mockResolvedValue({ count: 1 });

        await expect(new BookingService().markExpiredBookingsNoShow()).resolves.toBe(1);
        expect(prismaMock.booking.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ['expired'] }, status: 'CONFIRMED', checkedInAt: null },
            data: { status: 'NO_SHOW' },
        });
    });
});
