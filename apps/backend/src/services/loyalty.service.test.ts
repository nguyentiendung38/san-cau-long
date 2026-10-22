import { describe, expect, it, vi } from 'vitest';
import {
    adjustBookingPointRedemption,
    getMaxRedeemPoints,
    getPointsEarned,
    LOYALTY_POINT_VALUE_VND,
} from './loyalty.service.js';
import type { Prisma } from '@prisma/client';

describe('loyalty policy', () => {
    it('earns one point for each full 100,000 VND actually paid', () => {
        expect(getPointsEarned(0)).toBe(0);
        expect(getPointsEarned(99_999)).toBe(0);
        expect(getPointsEarned(100_000)).toBe(1);
        expect(getPointsEarned(299_999)).toBe(2);
        expect(getPointsEarned(300_000)).toBe(3);
    });

    it('caps redemption to available points and 20 percent of the court charge', () => {
        expect(getMaxRedeemPoints(1_000_000, 999)).toBe(999);
        expect(getMaxRedeemPoints(1_000_000, 250)).toBe(250);
        expect(getMaxRedeemPoints(10_000, 100)).toBe(20);
        expect(getMaxRedeemPoints(99, 100)).toBe(0);
    });

    it('converts each point at 100 VND', () => {
        expect(100 * LOYALTY_POINT_VALUE_VND).toBe(10_000);
    });

    it('releases reserved points when a pending booking uses fewer points after rescheduling', async () => {
        const updateMany = vi.fn().mockResolvedValue({ count: 1 });
        const tx = {
            pointsTransaction: { findUnique: vi.fn().mockResolvedValue(null) },
            customer: { updateMany },
        } as unknown as Prisma.TransactionClient;

        await expect(adjustBookingPointRedemption(
            tx,
            { id: 'request-1', customerId: 'customer-1', redeemPoints: 40 },
            20,
            '2025-01-01T12:00:00.000Z',
        )).resolves.toBe(true);
        expect(updateMany).toHaveBeenCalledWith({
            where: { id: 'customer-1', reservedPoints: { gte: 40 } },
            data: { reservedPoints: { decrement: 20 } },
        });
    });

    it('returns points already spent when an approved booking uses fewer points after rescheduling', async () => {
        const create = vi.fn().mockResolvedValue({});
        const updateMany = vi.fn().mockResolvedValue({ count: 1 });
        const tx = {
            pointsTransaction: {
                findUnique: vi.fn()
                    .mockResolvedValueOnce({ id: 'redeem-1' })
                    .mockResolvedValueOnce(null),
                create,
            },
            customer: { updateMany },
        } as unknown as Prisma.TransactionClient;

        await expect(adjustBookingPointRedemption(
            tx,
            { id: 'request-1', customerId: 'customer-1', redeemPoints: 40 },
            20,
            '2025-01-01T12:00:00.000Z',
        )).resolves.toBe(true);
        expect(updateMany).toHaveBeenCalledWith({
            where: { id: 'customer-1' },
            data: { points: { increment: 20 } },
        });
        expect(create).toHaveBeenCalledWith({
            data: {
                customerId: 'customer-1',
                type: 'REVERSAL',
                points: 20,
                reason: 'Hoàn lại điểm chưa sử dụng do giảm giá trị đổi điểm sau khi đổi lịch',
                referenceType: 'BOOKING_REQUEST',
                referenceId: 'request-1',
                idempotencyKey: 'booking-reschedule-refund:request-1:2025-01-01T12:00:00.000Z',
            },
        });
    });
});
