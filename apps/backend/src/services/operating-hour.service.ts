import prisma from '../config/database.js';
import { AppError } from '../middleware/error.js';

export interface OperatingHourQueryParams {
    venueId?: string;
    isActive?: boolean;
}

export interface CreateOperatingHourInput {
    venueId: string;
    startTime: string;
    endTime: string;
    daysOfWeek: string;
    isActive?: boolean;
}

export interface UpdateOperatingHourInput {
    startTime?: string;
    endTime?: string;
    daysOfWeek?: string;
    isActive?: boolean;
}

export class OperatingHourService {
    async getAll(params: OperatingHourQueryParams) {
        const { venueId, isActive } = params;

        const where: any = {};
        if (venueId) where.venueId = venueId;
        if (isActive !== undefined) where.isActive = isActive;

        const data = await prisma.operatingHour.findMany({
            where,
            orderBy: { startTime: 'asc' },
        });

        return { data };
    }

    async getById(id: string) {
        const item = await prisma.operatingHour.findUnique({ where: { id } });
        if (!item) throw new AppError(404, 'Không tìm thấy khung giờ');
        return item;
    }

    async create(input: CreateOperatingHourInput) {
        // Validate venue exists
        const venue = await prisma.venue.findUnique({ where: { id: input.venueId } });
        if (!venue) throw new AppError(404, 'Không tìm thấy cơ sở');

        return await prisma.operatingHour.create({ data: input });
    }

    async update(id: string, input: UpdateOperatingHourInput) {
        const existing = await prisma.operatingHour.findUnique({ where: { id } });
        if (!existing) throw new AppError(404, 'Không tìm thấy khung giờ');

        return await prisma.operatingHour.update({
            where: { id },
            data: input,
        });
    }

    async delete(id: string) {
        const existing = await prisma.operatingHour.findUnique({ where: { id } });
        if (!existing) throw new AppError(404, 'Không tìm thấy khung giờ');

        await prisma.operatingHour.delete({ where: { id } });
        return { message: 'Đã xóa khung giờ' };
    }
}

export const operatingHourService = new OperatingHourService();
