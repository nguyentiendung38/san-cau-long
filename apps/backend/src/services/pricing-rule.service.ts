import prisma from '../config/database.js';
import { AppError } from '../middleware/error.js';
import { timeToMinutes } from '../utils/booking-rules.js';

const validDaysOfWeek = new Set([
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY',
]);

export interface PricingRuleQueryParams {
    venueId?: string;
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
}

export interface CreatePricingRuleInput {
    venueId: string;
    name: string;
    description?: string | null;
    dayOfWeek?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    pricePerHour: number;
    priority?: number;
    isActive?: boolean;
}

export interface UpdatePricingRuleInput {
    venueId?: string;
    name?: string;
    description?: string | null;
    dayOfWeek?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    pricePerHour?: number;
    priority?: number;
    isActive?: boolean;
}

export class PricingRuleService {
    private validateTimeRange(startTime?: string | null, endTime?: string | null) {
        if ((startTime && !endTime) || (!startTime && endTime)) {
            throw new AppError(400, 'Vui lòng nhập đủ giờ bắt đầu và giờ kết thúc');
        }

        if (startTime && endTime) {
            const start = timeToMinutes(startTime);
            const end = timeToMinutes(endTime);
            if (start === null || end === null || start >= end) {
                throw new AppError(400, 'Giờ bắt đầu và kết thúc phải hợp lệ, giờ bắt đầu nhỏ hơn giờ kết thúc');
            }
            if (start % 30 !== 0 || end % 30 !== 0) {
                throw new AppError(400, 'Khung giá phải theo mốc 30 phút');
            }
        }
    }

    private validateDayOfWeek(dayOfWeek?: string | null) {
        if (dayOfWeek && !validDaysOfWeek.has(dayOfWeek)) {
            throw new AppError(400, 'Ngày áp dụng bảng giá không hợp lệ');
        }
    }

    async findAll(params: PricingRuleQueryParams = {}) {
        const { venueId, isActive, search, page = 1, limit = 20 } = params;

        const where: {
            venueId?: string;
            isActive?: boolean;
            OR?: Array<{ name?: { contains: string; mode: 'insensitive' } } | { description?: { contains: string; mode: 'insensitive' } }>;
        } = {};

        if (venueId) where.venueId = venueId;
        if (isActive !== undefined) where.isActive = isActive;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [rules, total] = await Promise.all([
            prisma.pricingRule.findMany({
                where,
                include: {
                    venue: {
                        select: { id: true, name: true },
                    },
                },
                orderBy: [
                    { priority: 'desc' },
                    { name: 'asc' },
                ],
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.pricingRule.count({ where }),
        ]);

        return {
            data: rules,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findById(id: string) {
        const rule = await prisma.pricingRule.findUnique({
            where: { id },
            include: {
                venue: {
                    select: { id: true, name: true },
                },
            },
        });

        if (!rule) {
            throw new AppError(404, 'Không tìm thấy khung giá');
        }

        return rule;
    }

    async create(input: CreatePricingRuleInput) {
        const venue = await prisma.venue.findUnique({
            where: { id: input.venueId },
        });

        if (!venue) {
            throw new AppError(404, 'Không tìm thấy cơ sở');
        }

        if (!input.name || input.name.trim() === '') {
            throw new AppError(400, 'Vui lòng nhập tên khung giá');
        }

        if (!Number.isFinite(Number(input.pricePerHour)) || Number(input.pricePerHour) <= 0) {
            throw new AppError(400, 'Giá mỗi giờ phải lớn hơn 0');
        }

        this.validateTimeRange(input.startTime, input.endTime);
        this.validateDayOfWeek(input.dayOfWeek);

        const rule = await prisma.pricingRule.create({
            data: {
                venueId: input.venueId,
                name: input.name.trim(),
                description: input.description?.trim() || null,
                dayOfWeek: input.dayOfWeek || null,
                startTime: input.startTime || null,
                endTime: input.endTime || null,
                pricePerHour: Number(input.pricePerHour),
                priority: input.priority ?? 0,
                isActive: input.isActive ?? true,
            },
            include: {
                venue: {
                    select: { id: true, name: true },
                },
            },
        });

        return rule;
    }

    async update(id: string, input: UpdatePricingRuleInput) {
        const existing = await prisma.pricingRule.findUnique({
            where: { id },
        });

        if (!existing) {
            throw new AppError(404, 'Không tìm thấy khung giá');
        }

        if (input.venueId && input.venueId !== existing.venueId) {
            const venue = await prisma.venue.findUnique({ where: { id: input.venueId } });
            if (!venue) throw new AppError(404, 'Không tìm thấy cơ sở');
        }

        const startTime = input.startTime !== undefined ? input.startTime : existing.startTime;
        const endTime = input.endTime !== undefined ? input.endTime : existing.endTime;
        this.validateTimeRange(startTime, endTime);
        this.validateDayOfWeek(input.dayOfWeek !== undefined ? input.dayOfWeek : existing.dayOfWeek);

        if (input.pricePerHour !== undefined && (!Number.isFinite(Number(input.pricePerHour)) || Number(input.pricePerHour) <= 0)) {
            throw new AppError(400, 'Giá mỗi giờ phải lớn hơn 0');
        }

        const rule = await prisma.pricingRule.update({
            where: { id },
            data: {
                ...(input.venueId !== undefined ? { venueId: input.venueId } : {}),
                ...(input.name !== undefined ? { name: input.name.trim() || existing.name } : {}),
                ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
                ...(input.dayOfWeek !== undefined ? { dayOfWeek: input.dayOfWeek || null } : {}),
                ...(input.startTime !== undefined ? { startTime: input.startTime || null } : {}),
                ...(input.endTime !== undefined ? { endTime: input.endTime || null } : {}),
                ...(input.pricePerHour !== undefined ? { pricePerHour: Number(input.pricePerHour) } : {}),
                ...(input.priority !== undefined ? { priority: input.priority } : {}),
                ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            },
            include: {
                venue: {
                    select: { id: true, name: true },
                },
            },
        });

        return rule;
    }

    async delete(id: string) {
        const existing = await prisma.pricingRule.findUnique({
            where: { id },
        });

        if (!existing) {
            throw new AppError(404, 'Không tìm thấy khung giá');
        }

        await prisma.pricingRule.delete({ where: { id } });

        return { success: true };
    }
}

export const pricingRuleService = new PricingRuleService();
