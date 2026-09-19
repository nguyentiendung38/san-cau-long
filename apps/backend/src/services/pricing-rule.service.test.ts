import { describe, it, expect } from 'vitest';
import { pricingRuleService } from './pricing-rule.service.js';

describe('pricingRuleService', () => {
  it('exposes CRUD methods for pricing rules', () => {
    expect(pricingRuleService).toBeDefined();
    expect(typeof pricingRuleService.findAll).toBe('function');
    expect(typeof pricingRuleService.create).toBe('function');
    expect(typeof pricingRuleService.update).toBe('function');
    expect(typeof pricingRuleService.delete).toBe('function');
  });
});
