import { describe, expect, it } from 'vitest';
import { calculatePriceFromRules, PricingRuleForCalculation } from './booking.service.js';

const defaultRule: PricingRuleForCalculation = {
    name: 'Giá mặc định',
    dayOfWeek: null,
    startTime: null,
    endTime: null,
    pricePerHour: 150000,
    priority: 0,
};

describe('booking price calculation', () => {
    it('charges half the hourly rate for one 30-minute slot', () => {
        const result = calculatePriceFromRules([defaultRule], 'THURSDAY', '16:30', '17:00');

        expect(result.duration).toBe(0.5);
        expect(result.total).toBe(75000);
        expect(result.pricePerHour).toBe(150000);
    });

    it('charges one hourly rate for two consecutive 30-minute slots', () => {
        const result = calculatePriceFromRules([defaultRule], 'THURSDAY', '16:30', '17:30');

        expect(result.duration).toBe(1);
        expect(result.total).toBe(150000);
    });

    it('applies the configured rate for each selected time slot', () => {
        const eveningRule: PricingRuleForCalculation = {
            name: 'Giá buổi tối',
            dayOfWeek: null,
            startTime: '17:00',
            endTime: '18:00',
            pricePerHour: 200000,
            priority: 5,
        };
        const result = calculatePriceFromRules([eveningRule, defaultRule], 'THURSDAY', '16:30', '17:30');

        expect(result.duration).toBe(1);
        expect(result.total).toBe(175000);
        expect(result.appliedRule).toBe('Giá mặc định, Giá buổi tối');
    });
});
