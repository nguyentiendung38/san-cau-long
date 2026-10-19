import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
    prismaMock: {
        venue: { findUnique: vi.fn(), update: vi.fn() },
    },
}));

vi.mock('../config/database.js', () => ({ default: prismaMock }));

import { VenueService } from './venue.service.js';

describe('venue archival', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deactivates a venue without deleting its related records', async () => {
        prismaMock.venue.findUnique.mockResolvedValue({ id: 'venue-1', isActive: true });
        prismaMock.venue.update.mockResolvedValue({ id: 'venue-1', isActive: false });

        await expect(new VenueService().delete('venue-1'))
            .resolves.toMatchObject({ message: expect.stringContaining('hóa đơn được giữ nguyên') });
        expect(prismaMock.venue.update).toHaveBeenCalledWith({
            where: { id: 'venue-1' },
            data: { isActive: false },
        });
    });

    it('returns not found for an unknown venue', async () => {
        prismaMock.venue.findUnique.mockResolvedValue(null);

        await expect(new VenueService().delete('missing'))
            .rejects.toMatchObject({ statusCode: 404 });
        expect(prismaMock.venue.update).not.toHaveBeenCalled();
    });
});
