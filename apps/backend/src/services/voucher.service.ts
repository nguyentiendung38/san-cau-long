import prisma from '../config/database.js';
import { AppError } from '../middleware/error.js';

export class VoucherService {
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
        const exists = await prisma.voucher.findUnique({ where: { code: data.code } });
        if (exists) throw new AppError(409, 'Mã ưu đãi này đã tồn tại');

        return prisma.voucher.create({
            data: {
                code: data.code,
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
        await this.getById(id);
        if (data.code) {
            const exists = await prisma.voucher.findUnique({ where: { code: data.code } });
            if (exists && exists.id !== id) throw new AppError(409, 'Mã ưu đãi này đã tồn tại');
        }

        return prisma.voucher.update({
            where: { id },
            data: {
                ...(data.code !== undefined && { code: data.code }),
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
        const item = await prisma.voucher.findUnique({ where: { code } });
        if (!item || !item.isActive) throw new AppError(400, 'Mã ưu đãi không hợp lệ hoặc đã tắt');

        const now = new Date();
        if (item.startDate && now < item.startDate) throw new AppError(400, 'Mã chưa đến thời gian áp dụng');
        if (item.endDate && now > item.endDate) throw new AppError(400, 'Mã ưu đãi đã hết hạn');
        
        if (item.usageLimit && item.usageCount >= item.usageLimit) throw new AppError(400, 'Mã ưu đãi đã hết lượt dùng');
        
        if (item.minOrderValue && orderValue < item.minOrderValue) throw new AppError(400, 'Chưa đạt giá trị đơn tối thiểu');

        let discount = 0;
        if (item.discountType === 'FIXED') {
            discount = item.discountValue;
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
}

export const voucherService = new VoucherService();
