import { describe, expect, it } from 'vitest';
import {
    isWithinOperatingHours,
    parseDaysOfWeek,
    validateOperatingHourRange,
} from './booking-rules.js';

describe('booking operating-hour rules', () => {
    const hours = [
        { startTime: '06:00', endTime: '12:00', daysOfWeek: '[1,2,3,4,5]', isActive: true },
        { startTime: '13:00', endTime: '23:00', daysOfWeek: '[1,2,3,4,5]', isActive: true },
    ];

    it('accepts a booking fully inside either configured operating window', () => {
        expect(isWithinOperatingHours(hours, 1, '06:30', '07:00')).toBe(true);
        expect(isWithinOperatingHours(hours, 1, '13:00', '13:30')).toBe(true);
    });

    it('accepts bookings spanning adjacent operating windows', () => {
        const adjacentHours = [
            { startTime: '06:00', endTime: '12:00', daysOfWeek: '[1]', isActive: true },
            { startTime: '12:00', endTime: '23:00', daysOfWeek: '[1]', isActive: true },
        ];

        expect(isWithinOperatingHours(adjacentHours, 1, '11:30', '12:30')).toBe(true);
    });

    it('rejects bookings that span a break, fall outside hours, or use a closed day', () => {
        expect(isWithinOperatingHours(hours, 1, '11:30', '13:30')).toBe(false);
        expect(isWithinOperatingHours(hours, 1, '05:30', '06:00')).toBe(false);
        expect(isWithinOperatingHours(hours, 0, '10:00', '10:30')).toBe(false);
        expect(isWithinOperatingHours([], 1, '10:00', '10:30')).toBe(false);
    });

    it('parses unique weekday numbers and rejects invalid schedules', () => {
        expect(parseDaysOfWeek('[1,1,5]')).toEqual([1, 5]);
        expect(() => validateOperatingHourRange('06:15', '12:00', '[1,2]')).toThrow();
        expect(() => validateOperatingHourRange('12:00', '06:00', '[1,2]')).toThrow();
        expect(() => validateOperatingHourRange('06:00', '12:00', '[]')).toThrow();
    });
});
