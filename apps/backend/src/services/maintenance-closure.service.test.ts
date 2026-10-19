import { describe, expect, it } from 'vitest';
import { bookingInterval, intervalsOverlap } from './maintenance-closure.service.js';

describe('maintenance closure interval checks', () => {
    it('maps a booking date and wall-clock slots to the same UTC calendar interval', () => {
        const interval = bookingInterval(new Date('2026-10-17T00:00:00.000Z'), '09:30', '10:30');
        expect(interval.startAt.toISOString()).toBe('2026-10-17T09:30:00.000Z');
        expect(interval.endAt.toISOString()).toBe('2026-10-17T10:30:00.000Z');
    });

    it('blocks intersecting ranges but allows adjacent ranges', () => {
        const start = new Date('2026-10-17T09:30:00.000Z');
        const end = new Date('2026-10-17T10:30:00.000Z');
        expect(intervalsOverlap(start, end, new Date('2026-10-17T10:00:00.000Z'), new Date('2026-10-17T11:00:00.000Z'))).toBe(true);
        expect(intervalsOverlap(start, end, end, new Date('2026-10-17T11:00:00.000Z'))).toBe(false);
    });
});
