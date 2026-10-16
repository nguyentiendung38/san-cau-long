import prisma from '../config/database.js';
import { AppError } from '../middleware/error.js';
import { parseDaysOfWeek, timeToMinutes, validateOperatingHourRange } from '../utils/booking-rules.js';

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
    venueId?: string;
    startTime?: string;
    endTime?: string;
    daysOfWeek?: string;
    isActive?: boolean;
}

export class OperatingHourService {
    private async validateNoOverlap(
        venueId: string,
        startTime: string,
        endTime: string,
        daysOfWeek: string,
        excludeId?: string,
    ) {
        const selectedDays = validateOperatingHourRange(startTime, endTime, daysOfWeek);
        const existingHours = await prisma.operatingHour.findMany({
            where: {
                venueId,
                isActive: true,
                ...(excludeId ? { id: { not: excludeId } } : {}),
            },
        });
        const start = timeToMinutes(startTime)!;
        const end = timeToMinutes(endTime)!;
        const overlaps = existingHours.some((hour) => {
            const sharedDay = parseDaysOfWeek(hour.daysOfWeek).some((day) => selectedDays.includes(day));
            const existingStart = timeToMinutes(hour.startTime);
            const existingEnd = timeToMinutes(hour.endTime);
            return sharedDay && existingStart !== null && existingEnd !== null &&
                start < existingEnd && existingStart < end;
        });

        if (overlaps) {
            throw new AppError(409, 'Khung giờ bị trùng với giờ hoạt động khác trong cùng ngày');
        }
    }

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
        const venue = await prisma.venue.findUnique({ where: { id: input.venueId } });
        if (!venue) throw new AppError(404, 'Không tìm thấy cơ sở');

        if (input.isActive !== false) {
            await this.validateNoOverlap(input.venueId, input.startTime, input.endTime, input.daysOfWeek);
        } else {
            validateOperatingHourRange(input.startTime, input.endTime, input.daysOfWeek);
        }
        return await prisma.operatingHour.create({ data: input });
    }

    async update(id: string, input: UpdateOperatingHourInput) {
        const existing = await prisma.operatingHour.findUnique({ where: { id } });
        if (!existing) throw new AppError(404, 'Không tìm thấy khung giờ');

        const venueId = input.venueId ?? existing.venueId;
        const startTime = input.startTime ?? existing.startTime;
        const endTime = input.endTime ?? existing.endTime;
        const daysOfWeek = input.daysOfWeek ?? existing.daysOfWeek;
        const isActive = input.isActive ?? existing.isActive;

        if (input.venueId) {
            const venue = await prisma.venue.findUnique({ where: { id: venueId } });
            if (!venue) throw new AppError(404, 'Không tìm thấy cơ sở');
        }
        if (isActive) {
            await this.validateNoOverlap(venueId, startTime, endTime, daysOfWeek, id);
        } else {
            validateOperatingHourRange(startTime, endTime, daysOfWeek);
        }

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
