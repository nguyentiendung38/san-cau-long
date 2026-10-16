import { describe, expect, it } from 'vitest';
import { calculateBookingSnapshot, parseBookingOrder } from './booking-order.js';

describe('booking order snapshots', () => {
    it('reads legacy item arrays and new order snapshots', () => {
        const item = { id: 'product-1', name: 'Nước', price: 10000, quantity: 2, type: 'product' as const };
        expect(parseBookingOrder(JSON.stringify([item]))).toEqual({
            items: [item],
            discountAmount: 0,
        });
        expect(parseBookingOrder(JSON.stringify({
            items: [item],
            discountAmount: 5000,
            voucherCode: 'GIAM5',
            totalAmount: 25000,
        }))).toEqual({
            items: [item],
            discountAmount: 5000,
            voucherCode: 'GIAM5',
            totalAmount: 25000,
        });
    });

    it('rejects invalid quantities and totals instead of silently dropping line items', () => {
        expect(() => parseBookingOrder(JSON.stringify({
            items: [{ id: 'product-1', name: 'Nước', price: 10000, quantity: 0, type: 'product' }],
        }))).toThrow();
        expect(() => parseBookingOrder(JSON.stringify({ items: [], totalAmount: -1 }))).toThrow();
    });

    it('reconstructs the court line so invoice items and voucher discounts are not double-counted', () => {
        const order = parseBookingOrder(JSON.stringify({
            items: [{ id: 'product-1', name: 'Nước', price: 10000, quantity: 2, type: 'product' }],
            discountAmount: 5000,
            totalAmount: 25000,
        }));
        expect(calculateBookingSnapshot(25000, order)).toEqual({
            courtAmount: 10000,
            itemsAmount: 20000,
            subtotal: 30000,
            discountAmount: 5000,
            total: 25000,
        });
    });
});
