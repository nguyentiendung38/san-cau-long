import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
    prismaMock: {
        booking: { findUnique: vi.fn(), updateMany: vi.fn() },
        venueStaff: { findUnique: vi.fn() },
    },
}));

vi.mock('../config/database.js', () => ({ default: prismaMock }));

import { BookingService } from './booking.service.js';

describe('booking no-show handling', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-17T15:00:00.000Z'));
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('records an ended, confirmed booking as no-show for assigned staff', async () => {
        prismaMock.booking.findUnique
            .mockResolvedValueOnce({
                id: 'booking-1',
                date: new Date('2026-10-17T00:00:00.000Z'),
                endTime: '14:00',
                status: 'CONFIRMED',
                checkedInAt: null,
                court: { venueId: 'venue-1' },
            })
            .mockResolvedValueOnce({ id: 'booking-1', status: 'NO_SHOW' });
        prismaMock.venueStaff.findUnique.mockResolvedValue({ id: 'assignment-1' });
        prismaMock.booking.updateMany.mockResolvedValue({ count: 1 });

        await expect(new BookingService().markNoShow('booking-1', 'staff-1', 'STAFF'))
            .resolves.toMatchObject({ id: 'booking-1', status: 'NO_SHOW' });
        expect(prismaMock.booking.updateMany).toHaveBeenCalledWith({
            where: { id: 'booking-1', status: 'CONFIRMED', checkedInAt: null },
            data: { status: 'NO_SHOW' },
        });
    });

    it('rejects marking a booking before its scheduled end', async () => {
        prismaMock.booking.findUnique.mockResolvedValue({
            id: 'booking-1',
            date: new Date('2026-10-17T00:00:00.000Z'),
            endTime: '23:30',
            status: 'CONFIRMED',
            checkedInAt: null,
            court: { venueId: 'venue-1' },
        });
        prismaMock.venueStaff.findUnique.mockResolvedValue({ id: 'assignment-1' });

        await expect(new BookingService().markNoShow('booking-1', 'staff-1', 'STAFF'))
            .rejects.toMatchObject({ statusCode: 400 });
        expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a booking that has already been checked in', async () => {
        prismaMock.booking.findUnique.mockResolvedValue({
            id: 'booking-1',
            status: 'IN_PROGRESS',
            checkedInAt: new Date('2026-10-17T14:00:00.000Z'),
            court: { venueId: 'venue-1' },
        });

        await expect(new BookingService().markNoShow('booking-1', 'admin-1', 'ADMIN'))
            .rejects.toMatchObject({ statusCode: 409 });
        expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
    });
});
