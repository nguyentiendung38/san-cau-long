import prisma from '../config/database.js';
import { AppError } from '../middleware/error.js';

export class VoucherService {
    private validateConfiguration(data: {
        code?: string;
        discountType: string;
        discountValue: number;
        minOrderValue?: number | null;
        maxDiscount?: number | null;
        usageLimit?: number | null;
        startDate?: string | Date | null;
        endDate?: string | Date | null;
    }) {
        if (!data.code?.trim()) throw new AppError(400, 'Vui lòng nhập mã ưu đãi');
        if (!['PERCENTAGE', 'FIXED'].includes(data.discountType)) {
            throw new AppError(400, 'Loại giảm giá không hợp lệ');
        }
        if (!Number.isFinite(Number(data.discountValue)) || Number(data.discountValue) <= 0) {
            throw new AppError(400, 'Mức giảm giá phải lớn hơn 0');
        }
        if (data.discountType === 'PERCENTAGE' && Number(data.discountValue) > 100) {
            throw new AppError(400, 'Mức giảm theo phần trăm không được vượt quá 100%');
        }
        for (const value of [data.minOrderValue, data.maxDiscount, data.usageLimit]) {
            if (value !== undefined && value !== null && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
                throw new AppError(400, 'Giá trị điều kiện và giới hạn voucher không hợp lệ');
            }
        }
        const startDate = data.startDate ? new Date(data.startDate) : null;
        const endDate = data.endDate ? new Date(data.endDate) : null;
        if (
            (startDate && Number.isNaN(startDate.getTime())) ||
            (endDate && Number.isNaN(endDate.getTime())) ||
            (startDate && endDate && startDate > endDate)
        ) {
            throw new AppError(400, 'Thời gian áp dụng voucher không hợp lệ');
        }
    }

    async getAll() {
        return prisma.voucher.findMany({
            orderBy: { createdAt: 'desc' }
        });
    }

    async getById(id: string) {
        const item = await prisma.voucher.findUnique({ where: { id } });
        if (!item) throw new AppError(404, 'Không tìm thấy mã ưu đãi');
        return item;
    }

    async getByCode(code: string) {
        const item = await prisma.voucher.findUnique({ where: { code } });
        if (!item) throw new AppError(404, 'Mã ưu đãi không hợp lệ');
        return item;
    }

    async create(data: any) {
        const code = String(data.code || '').trim().toUpperCase();
        this.validateConfiguration({ ...data, code });
        const exists = await prisma.voucher.findUnique({ where: { code } });
        if (exists) throw new AppError(409, 'Mã ưu đãi này đã tồn tại');

        return prisma.voucher.create({
            data: {
                code,
                discountType: data.discountType,
                discountValue: data.discountValue,
                minOrderValue: data.minOrderValue || null,
                maxDiscount: data.maxDiscount || null,
                usageLimit: data.usageLimit || null,
                startDate: data.startDate ? new Date(data.startDate) : null,
                endDate: data.endDate ? new Date(data.endDate) : null,
                isActive: data.isActive ?? true,
            }
        });
    }

    async update(id: string, data: any) {
        const existing = await this.getById(id);
        const code = data.code !== undefined ? String(data.code).trim().toUpperCase() : existing.code;
        this.validateConfiguration({
            code,
            discountType: data.discountType ?? existing.discountType,
            discountValue: data.discountValue ?? existing.discountValue,
            minOrderValue: data.minOrderValue !== undefined ? data.minOrderValue : existing.minOrderValue,
            maxDiscount: data.maxDiscount !== undefined ? data.maxDiscount : existing.maxDiscount,
            usageLimit: data.usageLimit !== undefined ? data.usageLimit : existing.usageLimit,
            startDate: data.startDate !== undefined ? data.startDate : existing.startDate,
            endDate: data.endDate !== undefined ? data.endDate : existing.endDate,
        });
        if (data.code !== undefined) {
            const exists = await prisma.voucher.findUnique({ where: { code } });
            if (exists && exists.id !== id) throw new AppError(409, 'Mã ưu đãi này đã tồn tại');
        }

        return prisma.voucher.update({
            where: { id },
            data: {
                ...(data.code !== undefined && { code }),
                ...(data.discountType !== undefined && { discountType: data.discountType }),
                ...(data.discountValue !== undefined && { discountValue: data.discountValue }),
                ...(data.minOrderValue !== undefined && { minOrderValue: data.minOrderValue || null }),
                ...(data.maxDiscount !== undefined && { maxDiscount: data.maxDiscount || null }),
                ...(data.usageLimit !== undefined && { usageLimit: data.usageLimit || null }),
                ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
                ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
            }
        });
    }

    async delete(id: string) {
        await this.getById(id);
        return prisma.voucher.delete({ where: { id } });
    }

    async validate(code: string, orderValue: number) {
        if (!Number.isFinite(orderValue) || orderValue < 0) {
            throw new AppError(400, 'Giá trị đơn hàng không hợp lệ');
        }
        const item = await prisma.voucher.findUnique({ where: { code: code.trim().toUpperCase() } });
        if (!item || !item.isActive) throw new AppError(400, 'Mã ưu đãi không hợp lệ hoặc đã tắt');

        const now = new Date();
        if (item.startDate && now < item.startDate) throw new AppError(400, 'Mã chưa đến thời gian áp dụng');
        if (item.endDate) {
            const endOfExpiryDate = new Date(item.endDate);
            endOfExpiryDate.setHours(23, 59, 59, 999);
            if (now > endOfExpiryDate) throw new AppError(400, 'Mã ưu đãi đã hết hạn');
        }
        
        if (item.usageLimit && item.usageCount >= item.usageLimit) throw new AppError(400, 'Mã ưu đãi đã hết lượt dùng');
        
        if (item.minOrderValue && orderValue < item.minOrderValue) throw new AppError(400, 'Chưa đạt giá trị đơn tối thiểu');

        let discount = 0;
        if (item.discountType === 'FIXED') {
            discount = Math.min(item.discountValue, orderValue);
        } else {
            discount = orderValue * (item.discountValue / 100);
            if (item.maxDiscount && discount > item.maxDiscount) {
                discount = item.maxDiscount;
            }
        }

        return {
            valid: true,
            discountAmount: discount,
            voucher: item
        };
    }

    async consume(code: string) {
        const voucher = await prisma.voucher.findUnique({ where: { code: code.trim().toUpperCase() } });
        if (!voucher) throw new AppError(400, 'Mã ưu đãi không hợp lệ');
        await this.validate(voucher.code, voucher.minOrderValue || 0);
        const result = await prisma.voucher.updateMany({
            where: {
                id: voucher.id,
                isActive: true,
                ...(voucher.usageLimit ? { usageCount: { lt: voucher.usageLimit } } : {}),
            },
            data: { usageCount: { increment: 1 } },
        });
        if (result.count !== 1) {
            throw new AppError(409, 'Mã ưu đãi vừa hết lượt sử dụng, vui lòng chọn mã khác');
        }
    }
}

export const voucherService = new VoucherService();
