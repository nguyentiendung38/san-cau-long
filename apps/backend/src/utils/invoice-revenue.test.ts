import { describe, expect, it } from 'vitest';
import { calculateCollectedInvoiceRevenue } from './invoice-revenue.js';

describe('calculateCollectedInvoiceRevenue', () => {
    it('counts paid invoice totals and money received on partial invoices', () => {
        expect(calculateCollectedInvoiceRevenue(800_000, 100_000, 150_000)).toBe(1_050_000);
    });

    it('treats empty aggregates as zero', () => {
        expect(calculateCollectedInvoiceRevenue(null, null, null)).toBe(0);
    });
});
