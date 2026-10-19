import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, notifyMock } = vi.hoisted(() => ({
    prismaMock: {
        bookingRequest: { findUnique: vi.fn(), update: vi.fn() },
        operatingHour: { findMany: vi.fn() },
    },
    notifyMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../config/database.js', () => ({ default: prismaMock }));
vi.mock('./loyalty.service.js', () => ({
    LOYALTY_POINT_VALUE_VND: 100,
    awardInvoicePoints: vi.fn(),
    getMaxRedeemPoints: vi.fn(),
    redeemBookingPoints: vi.fn(),
    releaseBookingPointReservation: vi.fn(),
}));
vi.mock('./notification.service.js', () => ({
    notificationService: { bookingChangeRequest: notifyMock },
    safelyQueueNotification: vi.fn(async (task: Promise<void>) => task),
}));

import { BookingRequestService } from './booking-request.service.js';

function futureBooking() {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() + 4);
    return {
        id: 'request-1',
        customerId: 'customer-1',
        venueId: 'venue-1',
        courtId: 'court-1',
        status: 'APPROVED',
        date,
        startTime: '12:00',
        endTime: '13:00',
        cancellationRequestStatus: null,
    };
}

describe('customer booking change requests', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('rejects requests made for another customer account', async () => {
        prismaMock.bookingRequest.findUnique.mockResolvedValue({ ...futureBooking(), customerId: 'owner' });

        await expect(new BookingRequestService().requestCancellation('request-1', 'attacker', 'reason'))
            .rejects.toMatchObject({ statusCode: 403 });
        expect(prismaMock.bookingRequest.update).not.toHaveBeenCalled();
    });

    it('enforces the 24-hour advance notice deadline for cancellations', async () => {
        const booking = futureBooking();
        booking.date = new Date();
        booking.date.setUTCHours(0, 0, 0, 0);
        booking.date.setUTCDate(booking.date.getUTCDate() + 1);
        booking.startTime = '06:00';
        prismaMock.bookingRequest.findUnique.mockResolvedValue(booking);

        await expect(new BookingRequestService().requestCancellation('request-1', 'customer-1', 'reason'))
            .rejects.toMatchObject({ statusCode: 400 });
        expect(prismaMock.bookingRequest.update).not.toHaveBeenCalled();
    });

    it('rejects a reschedule outside the venue operating hours', async () => {
        const booking = futureBooking();
        prismaMock.bookingRequest.findUnique.mockResolvedValue(booking);
        const target = new Date(booking.date.getTime() + 86_400_000);
        prismaMock.operatingHour.findMany.mockResolvedValue([{
            daysOfWeek: JSON.stringify([(target.getUTCDay() + 1) % 7]),
            startTime: '06:00',
            endTime: '23:00',
        }]);

        await expect(new BookingRequestService().requestCancellation('request-1', 'customer-1', 'reason', {
            type: 'RESCHEDULE',
            date: target,
            startTime: '12:00',
            endTime: '13:00',
        })).rejects.toMatchObject({ statusCode: 400 });
        expect(prismaMock.bookingRequest.update).not.toHaveBeenCalled();
    });
});
