import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { AppError } from '../middleware/error.js';

export const LOYALTY_EARN_VND = 100_000;
export const LOYALTY_POINT_VALUE_VND = 100;
export const LOYALTY_MAX_COURT_DISCOUNT_RATE = 0.2;

export function getPointsEarned(spendAmount: number): number {
    if (!Number.isFinite(spendAmount) || spendAmount <= 0) return 0;
    return Math.floor(spendAmount / LOYALTY_EARN_VND);
}

export function getMaxRedeemPoints(courtAmount: number, availablePoints: number): number {
    if (!Number.isFinite(courtAmount) || !Number.isFinite(availablePoints)) return 0;
    return Math.max(0, Math.min(
        Math.floor(availablePoints),
        Math.floor((Math.max(0, courtAmount) * LOYALTY_MAX_COURT_DISCOUNT_RATE) / LOYALTY_POINT_VALUE_VND),
    ));
}

export async function awardInvoicePoints(
    tx: Prisma.TransactionClient,
    invoice: { id: string; customerId: string | null; total: number },
) {
    if (!invoice.customerId || !Number.isFinite(invoice.total) || invoice.total < LOYALTY_EARN_VND) return 0;

    const points = getPointsEarned(invoice.total);
    if (points <= 0) return 0;

    const idempotencyKey = `invoice-paid:${invoice.id}`;
    const existing = await tx.pointsTransaction.findUnique({ where: { idempotencyKey } });
    if (existing) return 0;

    await tx.pointsTransaction.create({
        data: {
            customerId: invoice.customerId,
            invoiceId: invoice.id,
            type: 'EARN',
            points,
            reason: `Tích điểm từ hóa đơn (${invoice.total.toLocaleString('vi-VN')}đ)`,
            referenceType: 'INVOICE',
            referenceId: invoice.id,
            idempotencyKey,
        },
    });
    await tx.customer.update({
        where: { id: invoice.customerId },
        data: { points: { increment: points } },
    });
    return points;
}

export async function redeemBookingPoints(
    tx: Prisma.TransactionClient,
    request: { id: string; customerId: string | null; status: string; paymentStatus: string; redeemPoints: number },
) {
    if (request.status !== 'APPROVED' || request.paymentStatus !== 'PAID' || request.redeemPoints <= 0) return false;
    if (!request.customerId) throw new AppError(400, 'Không xác định được tài khoản để sử dụng điểm');

    const idempotencyKey = `booking-redeem:${request.id}`;
    if (await tx.pointsTransaction.findUnique({ where: { idempotencyKey } })) return false;

    const result = await tx.customer.updateMany({
        where: {
            id: request.customerId,
            points: { gte: request.redeemPoints },
            reservedPoints: { gte: request.redeemPoints },
        },
        data: {
            points: { decrement: request.redeemPoints },
            reservedPoints: { decrement: request.redeemPoints },
        },
    });
    if (result.count !== 1) {
        throw new AppError(409, 'Số dư điểm không đủ để hoàn tất giao dịch; vui lòng kiểm tra với cơ sở');
    }

    await tx.pointsTransaction.create({
        data: {
            customerId: request.customerId,
            type: 'REDEEM',
            points: -request.redeemPoints,
            reason: `Đổi điểm cho yêu cầu đặt sân`,
            referenceType: 'BOOKING_REQUEST',
            referenceId: request.id,
            idempotencyKey,
        },
    });
    return true;
}

export async function adjustBookingPointRedemption(
    tx: Prisma.TransactionClient,
    request: { id: string; customerId: string | null; redeemPoints: number },
    nextRedeemPoints: number,
    operationId: string,
) {
    if (!Number.isInteger(nextRedeemPoints) || nextRedeemPoints < 0 || nextRedeemPoints > request.redeemPoints) {
        throw new AppError(400, 'Số điểm đổi sau khi đổi lịch không hợp lệ');
    }
    const pointsToRelease = request.redeemPoints - nextRedeemPoints;
    if (pointsToRelease === 0) return false;
    if (!request.customerId) throw new AppError(400, 'Không xác định được tài khoản để điều chỉnh điểm');

    const redemption = await tx.pointsTransaction.findUnique({
        where: { idempotencyKey: `booking-redeem:${request.id}` },
        select: { id: true },
    });
    if (redemption) {
        const idempotencyKey = `booking-reschedule-refund:${request.id}:${operationId}`;
        if (await tx.pointsTransaction.findUnique({ where: { idempotencyKey }, select: { id: true } })) {
            return false;
        }
        const result = await tx.customer.updateMany({
            where: { id: request.customerId },
            data: { points: { increment: pointsToRelease } },
        });
        if (result.count !== 1) throw new AppError(404, 'Không tìm thấy khách hàng để hoàn điểm');
        await tx.pointsTransaction.create({
            data: {
                customerId: request.customerId,
                type: 'REVERSAL',
                points: pointsToRelease,
                reason: 'Hoàn lại điểm chưa sử dụng do giảm giá trị đổi điểm sau khi đổi lịch',
                referenceType: 'BOOKING_REQUEST',
                referenceId: request.id,
                idempotencyKey,
            },
        });
        return true;
    }

    const result = await tx.customer.updateMany({
        where: { id: request.customerId, reservedPoints: { gte: request.redeemPoints } },
        data: { reservedPoints: { decrement: pointsToRelease } },
    });
    if (result.count !== 1) {
        throw new AppError(409, 'Không thể điều chỉnh số điểm đang giữ; vui lòng kiểm tra hồ sơ khách hàng');
    }
    return true;
}

export async function releaseBookingPointReservation(
    tx: Prisma.TransactionClient,
    request: { id: string; customerId: string | null; redeemPoints: number },
) {
    if (!request.customerId || request.redeemPoints <= 0) return false;

    const idempotencyKey = `booking-release:${request.id}`;
    if (await tx.pointsTransaction.findUnique({ where: { idempotencyKey } })) return false;
    if (await tx.pointsTransaction.findUnique({ where: { idempotencyKey: `booking-redeem:${request.id}` } })) {
        return false;
    }

    const result = await tx.customer.updateMany({
        where: { id: request.customerId, reservedPoints: { gte: request.redeemPoints } },
        data: { reservedPoints: { decrement: request.redeemPoints } },
    });
    if (result.count !== 1) {
        throw new AppError(409, 'Không thể giải phóng số điểm đã giữ; vui lòng kiểm tra hồ sơ khách hàng');
    }

    await tx.pointsTransaction.create({
        data: {
            customerId: request.customerId,
            type: 'RELEASE',
            points: 0,
            reason: 'Hoàn lại điểm đã giữ cho yêu cầu đặt sân chưa hoàn tất',
            referenceType: 'BOOKING_REQUEST',
            referenceId: request.id,
            idempotencyKey,
        },
    });
    return true;
}

export async function reverseInvoicePoints(
    tx: Prisma.TransactionClient,
    invoice: { id: string; customerId: string | null },
) {
    if (!invoice.customerId) return 0;
    const idempotencyKey = `invoice-refund:${invoice.id}`;
    if (await tx.pointsTransaction.findUnique({ where: { idempotencyKey } })) return 0;

    const earnedTransaction = await tx.pointsTransaction.findFirst({
        where: { invoiceId: invoice.id, type: 'EARN' },
    });
    const customer = await tx.customer.findUnique({
        where: { id: invoice.customerId },
        select: { points: true, reservedPoints: true },
    });
    if (!customer) throw new AppError(404, 'Không tìm thấy khách hàng của hóa đơn');

    const availablePoints = Math.max(0, customer.points - customer.reservedPoints);
    const reversedPoints = earnedTransaction ? Math.min(availablePoints, earnedTransaction.points) : 0;
    if (reversedPoints > 0) {
        await tx.customer.update({
            where: { id: invoice.customerId },
            data: { points: { decrement: reversedPoints } },
        });
    }
    await tx.pointsTransaction.create({
        data: {
            customerId: invoice.customerId,
            type: 'REVERSAL',
            points: -reversedPoints,
            reason: reversedPoints === (earnedTransaction?.points || 0)
                ? 'Thu hồi điểm do hoàn tiền hóa đơn'
                : 'Thu hồi số điểm còn khả dụng do hoàn tiền hóa đơn; điểm đã sử dụng không tạo số dư âm',
            referenceType: 'INVOICE',
            referenceId: invoice.id,
            idempotencyKey,
        },
    });
    return reversedPoints;
}

export async function addManualPoints(
    tx: Prisma.TransactionClient,
    customerId: string,
    points: number,
    reason: string,
) {
    const currentCustomer = await tx.customer.findUnique({
        where: { id: customerId },
        select: { points: true, reservedPoints: true },
    });
    if (!currentCustomer) throw new AppError(404, 'Không tìm thấy khách hàng');

    const customerUpdate = points > 0
        ? await tx.customer.updateMany({
            where: { id: customerId },
            data: { points: { increment: points } },
        })
        : await tx.customer.updateMany({
            where: {
                id: customerId,
                points: { gte: Math.abs(points) + currentCustomer.reservedPoints },
                reservedPoints: currentCustomer.reservedPoints,
            },
            data: { points: { decrement: Math.abs(points) } },
        });
    if (customerUpdate.count !== 1) {
        const exists = await tx.customer.findUnique({ where: { id: customerId }, select: { id: true } });
        if (!exists) throw new AppError(404, 'Không tìm thấy khách hàng');
        throw new AppError(400, 'Số điểm không thể làm số dư khách hàng thấp hơn 0');
    }

    await tx.pointsTransaction.create({
        data: {
            customerId,
            type: 'ADJUSTMENT',
            points,
            reason,
            referenceType: 'ADMIN_ADJUSTMENT',
            referenceId: randomUUID(),
            idempotencyKey: `manual:${randomUUID()}`,
        },
    });
    return tx.customer.findUniqueOrThrow({ where: { id: customerId } });
}
