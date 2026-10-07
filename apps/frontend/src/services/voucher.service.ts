import api from './api';

export interface Voucher {
    id: string;
    code: string;
    discountType: 'PERCENTAGE' | 'FIXED';
    discountValue: number;
    minOrderValue?: number;
    maxDiscount?: number;
    usageLimit?: number;
    usageCount: number;
    startDate?: string;
    endDate?: string;
    isActive: boolean;
}

export const voucherApi = {
    getAll: async (): Promise<Voucher[]> => {
        const res = await api.get('/vouchers');
        return res.data.data;
    },
    create: async (data: Partial<Voucher>): Promise<Voucher> => {
        const res = await api.post('/vouchers', data);
        return res.data.data;
    },
    update: async (id: string, data: Partial<Voucher>): Promise<Voucher> => {
        const res = await api.put(`/vouchers/${id}`, data);
        return res.data.data;
    },
    delete: async (id: string): Promise<void> => {
        await api.delete(`/vouchers/${id}`);
    },
    validate: async (code: string, orderValue: number): Promise<{ valid: boolean, discountAmount: number, voucher: Voucher }> => {
        const res = await api.post('/vouchers/validate', { code, orderValue });
        return res.data.data;
    }
};
