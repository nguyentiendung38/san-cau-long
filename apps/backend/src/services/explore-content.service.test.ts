import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
    prismaMock: {
        exploreContent: { findMany: vi.fn() },
    },
}));

vi.mock('../config/database.js', () => ({ default: prismaMock }));

import { ExploreContentService } from './explore-content.service.js';

describe('public explore content', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns only active content within its inclusive date range for public requests', async () => {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        prismaMock.exploreContent.findMany.mockResolvedValue([]);

        await new ExploreContentService().getAll('DEAL', true);

        expect(prismaMock.exploreContent.findMany).toHaveBeenCalledWith({
            where: {
                type: 'DEAL',
                isActive: true,
                AND: [
                    { OR: [{ startDate: null }, { startDate: { lte: today } }] },
                    { OR: [{ endDate: null }, { endDate: { gte: today } }] },
                ],
            },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        });
    });

    it('keeps inactive and scheduled content visible in the admin list', async () => {
        prismaMock.exploreContent.findMany.mockResolvedValue([]);

        await new ExploreContentService().getAll();

        expect(prismaMock.exploreContent.findMany).toHaveBeenCalledWith({
            where: {},
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        });
    });
});
