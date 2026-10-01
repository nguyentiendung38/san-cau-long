import prisma from '../config/database.js';
import { AppError } from '../middleware/error.js';

export class ExploreContentService {
    async getAll(type?: string, activeOnly = false) {
        return prisma.exploreContent.findMany({
            where: {
                ...(type ? { type } : {}),
                ...(activeOnly ? { isActive: true } : {}),
            },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        });
    }

    async getById(id: string) {
        const item = await prisma.exploreContent.findUnique({ where: { id } });
        if (!item) throw new AppError(404, 'Không tìm thấy nội dung');
        return item;
    }

    async create(data: any) {
        return prisma.exploreContent.create({
            data: {
                type: data.type,
                title: data.title,
                description: data.description,
                imageUrl: data.imageUrl,
                price: data.price,
                badge: data.badge,
                metadata: data.metadata ? JSON.stringify(data.metadata) : null,
                isActive: data.isActive ?? true,
                sortOrder: data.sortOrder ?? 0,
                startDate: data.startDate ? new Date(data.startDate) : null,
                endDate: data.endDate ? new Date(data.endDate) : null,
            },
        });
    }

    async update(id: string, data: any) {
        await this.getById(id);
        return prisma.exploreContent.update({
            where: { id },
            data: {
                ...(data.type !== undefined && { type: data.type }),
                ...(data.title !== undefined && { title: data.title }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
                ...(data.price !== undefined && { price: data.price }),
                ...(data.badge !== undefined && { badge: data.badge }),
                ...(data.metadata !== undefined && { metadata: typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata) }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
                ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
                ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
                ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
            },
        });
    }

    async delete(id: string) {
        await this.getById(id);
        return prisma.exploreContent.delete({ where: { id } });
    }
}
