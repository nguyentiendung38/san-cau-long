import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, transactionMock, releaseMock } = vi.hoisted(() => {
    const transactionMock = {
        bookingRequest: {
            updateMany: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    };
    return {
        prismaMock: {
            bookingRequest: { findMany: vi.fn(), findUnique: vi.fn() },
            $transaction: vi.fn(async (callback: (tx: typeof transactionMock) => unknown) => callback(transactionMock)),
        },
        transactionMock,
        releaseMock: vi.fn(),
    };
});

vi.mock('../config/database.js', () => ({ default: prismaMock }));
vi.mock('./loyalty.service.js', () => ({ releaseBookingPointReservation: releaseMock }));
vi.mock('./notification.service.js', () => ({
    notificationService: { bookingExpired: vi.fn().mockResolvedValue(undefined) },
    safelyQueueNotification: vi.fn(async (task: Promise<void>) => task),
}));

import { BookingRequestService } from './booking-request.service.js';

describe('unpaid bank-transfer request expiry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('expires only still-pending unpaid bank transfers and releases reserved points once', async () => {
        const request = {
            id: 'request-1',
            customerId: 'customer-1',
            redeemPoints: 20,
            status: 'EXPIRED',
            paymentStatus: 'FAILED',
        };
        prismaMock.bookingRequest.findMany.mockResolvedValue([{ id: request.id }]);
        prismaMock.bookingRequest.findUnique.mockResolvedValue(request);
        transactionMock.bookingRequest.updateMany.mockResolvedValue({ count: 1 });
        transactionMock.bookingRequest.findUnique.mockResolvedValue(request);
        transactionMock.bookingRequest.update.mockResolvedValue({});

        const service = new BookingRequestService();
        const expired = await service.expireUnpaidBankTransferRequests(new Date('2026-10-17T10:30:00.000Z'));

        expect(expired).toBe(1);
        expect(transactionMock.bookingRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                status: 'PENDING',
                paymentStatus: { not: 'PAID' },
                paymentMethod: 'DEPOSIT_TRANSFER',
            }),
            data: expect.objectContaining({ status: 'EXPIRED', paymentStatus: 'FAILED' }),
        }));
        expect(releaseMock).toHaveBeenCalledTimes(1);
        expect(releaseMock).toHaveBeenCalledWith(transactionMock, expect.objectContaining({ id: request.id, status: 'EXPIRED' }));
    });

    it('does not release points if payment or admin approval wins the expiry race', async () => {
        prismaMock.bookingRequest.findMany.mockResolvedValue([{ id: 'request-2' }]);
        transactionMock.bookingRequest.updateMany.mockResolvedValue({ count: 0 });

        const service = new BookingRequestService();
        const expired = await service.expireUnpaidBankTransferRequests(new Date('2026-10-17T10:30:00.000Z'));

        expect(expired).toBe(0);
        expect(releaseMock).not.toHaveBeenCalled();
        expect(transactionMock.bookingRequest.findUnique).not.toHaveBeenCalled();
    });

    it('rejects payment confirmation for an expired request', async () => {
        prismaMock.bookingRequest.findMany.mockResolvedValue([]);
        transactionMock.bookingRequest.findUnique.mockResolvedValue({
            id: 'request-expired',
            status: 'EXPIRED',
            paymentAmount: 100_000,
            orderedItems: JSON.stringify({ items: [], totalAmount: 100_000 }),
        });

        const service = new BookingRequestService();
        await expect(service.updatePaymentStatus('request-expired', 'PAID'))
            .rejects.toMatchObject({ statusCode: 409 });

        expect(transactionMock.bookingRequest.update).not.toHaveBeenCalled();
    });

    it('does not mark an underpaid booking request as paid', async () => {
        prismaMock.bookingRequest.findMany.mockResolvedValue([]);
        transactionMock.bookingRequest.findUnique.mockResolvedValue({
            id: 'request-underpaid',
            status: 'PENDING',
            paymentAmount: 100_000,
            orderedItems: JSON.stringify({ items: [], totalAmount: 100_000 }),
        });

        const service = new BookingRequestService();
        await expect(service.updatePaymentStatus('request-underpaid', 'PAID', 60_000))
            .rejects.toMatchObject({ statusCode: 400 });

        expect(transactionMock.bookingRequest.update).not.toHaveBeenCalled();
    });
});
