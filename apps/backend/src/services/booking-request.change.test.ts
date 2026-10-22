import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, notifyMock, calculatePriceMock } = vi.hoisted(() => ({
    prismaMock: {
        bookingRequest: { findUnique: vi.fn(), update: vi.fn() },
        operatingHour: { findMany: vi.fn() },
        customer: { findUnique: vi.fn() },
    },
    notifyMock: vi.fn().mockResolvedValue(undefined),
    calculatePriceMock: vi.fn(),
}));

vi.mock('../config/database.js', () => ({ default: prismaMock }));
vi.mock('./loyalty.service.js', () => ({
    LOYALTY_POINT_VALUE_VND: 100,
    awardInvoicePoints: vi.fn(),
    getMaxRedeemPoints: vi.fn((courtAmount: number, availablePoints: number) =>
        Math.max(0, Math.min(availablePoints, Math.floor((courtAmount * 0.2) / 100)))),
    redeemBookingPoints: vi.fn(),
    releaseBookingPointReservation: vi.fn(),
}));
vi.mock('./notification.service.js', () => ({
    notificationService: { bookingChangeRequest: notifyMock },
    safelyQueueNotification: vi.fn(async (task: Promise<void>) => task),
}));
vi.mock('./booking.service.js', () => ({
    BookingService: class {
        calculatePrice = calculatePriceMock;
    },
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

    it('quotes a reschedule using the new court price and verified student discount', async () => {
        const booking = {
            ...futureBooking(),
            orderedItems: JSON.stringify({ items: [], totalAmount: 100_000, paidAmount: 0 }),
            discountAmount: 0,
            loyaltyDiscountAmount: 0,
            redeemPoints: 0,
        };
        prismaMock.bookingRequest.findUnique.mockResolvedValue(booking);
        prismaMock.operatingHour.findMany.mockResolvedValue([{
            daysOfWeek: JSON.stringify([0, 1, 2, 3, 4, 5, 6]),
            startTime: '06:00',
            endTime: '23:00',
            isActive: true,
        }]);
        prismaMock.customer.findUnique.mockResolvedValue({ isVerifiedHue: true });
        prismaMock.bookingRequest.update.mockImplementation(async ({ data }) => ({ ...booking, ...data }));
        calculatePriceMock.mockResolvedValue({ total: 130_000, appliedRule: 'Giờ thường' });

        const target = new Date(booking.date.getTime() + 86_400_000);
        const updated = await new BookingRequestService().requestCancellation('request-1', 'customer-1', 'đổi giờ', {
            type: 'RESCHEDULE',
            date: target,
            startTime: '18:00',
            endTime: '19:00',
        });

        const snapshot = JSON.parse(updated.orderedItems!);
        expect(snapshot.requestedTotalAmount).toBe(104_000);
        expect(snapshot.paidAmount).toBe(0);
        expect(calculatePriceMock).toHaveBeenCalledWith('court-1', target, '18:00', '19:00');
    });

    it('caps redeemed points against the new court price', async () => {
        const booking = {
            ...futureBooking(),
            orderedItems: JSON.stringify({ items: [], totalAmount: 100_000, paidAmount: 0 }),
            discountAmount: 0,
            loyaltyDiscountAmount: 4_000,
            redeemPoints: 40,
        };
        prismaMock.bookingRequest.findUnique.mockResolvedValue(booking);
        prismaMock.operatingHour.findMany.mockResolvedValue([{
            daysOfWeek: JSON.stringify([0, 1, 2, 3, 4, 5, 6]),
            startTime: '06:00',
            endTime: '23:00',
            isActive: true,
        }]);
        prismaMock.customer.findUnique.mockResolvedValue({ isVerifiedHue: false });
        prismaMock.bookingRequest.update.mockImplementation(async ({ data }) => ({ ...booking, ...data }));
        calculatePriceMock.mockResolvedValue({ total: 10_000, appliedRule: 'Giờ thường' });

        const target = new Date(booking.date.getTime() + 86_400_000);
        const updated = await new BookingRequestService().requestCancellation('request-1', 'customer-1', 'đổi giờ', {
            type: 'RESCHEDULE',
            date: target,
            startTime: '18:00',
            endTime: '19:00',
        });

        const snapshot = JSON.parse(updated.orderedItems!);
        expect(snapshot.requestedTotalAmount).toBe(8_000);
        expect(snapshot.requestedRedeemPoints).toBe(20);
    });
});
