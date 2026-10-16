import { AppError } from '../middleware/error.js';

export type BookingOrderItem = {
    id: string;
    name: string;
    price: number;
    quantity: number;
    type: 'product' | 'service';
};

export interface StoredBookingOrder {
    items: BookingOrderItem[];
    discountAmount: number;
    voucherCode?: string;
    totalAmount?: number;
}

export function calculateBookingSnapshot(
    totalAmount: number,
    order: StoredBookingOrder,
): { courtAmount: number; itemsAmount: number; subtotal: number; discountAmount: number; total: number } {
    const itemsAmount = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const courtAmount = totalAmount + order.discountAmount - itemsAmount;
    if (!Number.isFinite(courtAmount) || courtAmount < 0) {
        throw new AppError(400, 'Tổng tiền lịch đặt không khớp với các dịch vụ đã chọn');
    }
    const subtotal = courtAmount + itemsAmount;
    return {
        courtAmount,
        itemsAmount,
        subtotal,
        discountAmount: order.discountAmount,
        total: Math.max(0, subtotal - order.discountAmount),
    };
}

export function parseBookingOrder(value?: string | null): StoredBookingOrder {
    if (!value) return { items: [], discountAmount: 0 };

    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch {
        throw new AppError(400, 'Chi tiết dịch vụ trong lịch đặt không hợp lệ');
    }

    const order: Partial<StoredBookingOrder> = Array.isArray(parsed)
        ? { items: parsed, discountAmount: 0 }
        : parsed as Partial<StoredBookingOrder>;
    if (!order || !Array.isArray(order.items)) {
        throw new AppError(400, 'Chi tiết dịch vụ trong lịch đặt không hợp lệ');
    }

    const items = order.items.map((item: any) => {
        if (
            !item ||
            typeof item.id !== 'string' ||
            typeof item.name !== 'string' ||
            !['product', 'service'].includes(item.type) ||
            !Number.isFinite(item.price) ||
            item.price < 0 ||
            !Number.isInteger(item.quantity) ||
            item.quantity < 1
        ) {
            throw new AppError(400, 'Sản phẩm hoặc dịch vụ trong lịch đặt không hợp lệ');
        }
        return item as BookingOrderItem;
    });
    const discountAmount = Number(order.discountAmount ?? 0);
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
        throw new AppError(400, 'Mức giảm giá trong lịch đặt không hợp lệ');
    }
    const totalAmount = order.totalAmount === undefined ? undefined : Number(order.totalAmount);
    if (totalAmount !== undefined && (!Number.isFinite(totalAmount) || totalAmount < 0)) {
        throw new AppError(400, 'Tổng tiền yêu cầu đặt không hợp lệ');
    }

    return {
        items,
        discountAmount,
        ...(totalAmount !== undefined ? { totalAmount } : {}),
        ...(typeof order.voucherCode === 'string' ? { voucherCode: order.voucherCode } : {}),
    };
}

export function serializeBookingOrder(
    items: BookingOrderItem[],
    discountAmount: number,
    voucherCode?: string,
): string | null {
    if (items.length === 0 && discountAmount === 0 && !voucherCode) return null;
    return JSON.stringify({ items, discountAmount, voucherCode });
}
