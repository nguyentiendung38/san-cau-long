import { describe, expect, it } from 'vitest';
import {
    getMaxRedeemPoints,
    getPointsEarned,
    LOYALTY_POINT_VALUE_VND,
} from './loyalty.service.js';

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
});
