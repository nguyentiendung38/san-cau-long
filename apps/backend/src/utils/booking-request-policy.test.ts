import { describe, expect, it } from 'vitest';
import { getBankTransferExpiry, isBookingStartInFuture, isChangeRequestBeforeDeadline } from './booking-request-policy.js';

describe('isBookingStartInFuture', () => {
    const now = new Date('2026-10-17T05:00:00.000Z'); // 12:00 in Vietnam

    it('accepts a later booking today in Vietnam time', () => {
        expect(isBookingStartInFuture(new Date('2026-10-17T00:00:00.000Z'), '12:30', now)).toBe(true);
    });

    describe('isChangeRequestBeforeDeadline', () => {
        const now = new Date('2026-10-17T05:00:00.000Z'); // 12:00 in Vietnam
        const tomorrow = new Date('2026-10-18T00:00:00.000Z');

        it('allows a request exactly 24 hours before the booking', () => {
            expect(isChangeRequestBeforeDeadline(tomorrow, '12:00', now)).toBe(true);
        });

        it('rejects requests made less than 24 hours before the booking', () => {
            expect(isChangeRequestBeforeDeadline(tomorrow, '11:30', now)).toBe(false);
        });
    });

    describe('bank-transfer hold deadline', () => {
        it('sets the request expiry exactly 30 minutes after creation', () => {
            const createdAt = new Date('2026-10-17T05:00:00.000Z');
            expect(getBankTransferExpiry(createdAt).toISOString()).toBe('2026-10-17T05:30:00.000Z');
        });
    });

    it('rejects a booking that has already started or starts now', () => {
        const date = new Date('2026-10-17T00:00:00.000Z');
        expect(isBookingStartInFuture(date, '11:30', now)).toBe(false);
        expect(isBookingStartInFuture(date, '12:00', now)).toBe(false);
    });

    it('accepts a future calendar day and rejects a past one', () => {
        expect(isBookingStartInFuture(new Date('2026-10-18T00:00:00.000Z'), '06:00', now)).toBe(true);
        expect(isBookingStartInFuture(new Date('2026-10-16T00:00:00.000Z'), '23:30', now)).toBe(false);
    });
});
