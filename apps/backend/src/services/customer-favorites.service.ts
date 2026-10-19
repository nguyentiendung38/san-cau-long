import prisma from '../config/database.js';
import { AppError } from '../middleware/error.js';

export const customerFavoritesService = {
    async get(customerId: string) {
        const [venues, courts] = await Promise.all([
            prisma.customerFavoriteVenue.findMany({ where: { customerId }, select: { venueId: true } }),
            prisma.customerFavoriteCourt.findMany({ where: { customerId }, select: { courtId: true } }),
        ]);
        return {
            venueIds: venues.map(({ venueId }) => venueId),
            courtIds: courts.map(({ courtId }) => courtId),
        };
    },

    async setVenue(customerId: string, venueId: string, favorite: boolean) {
        const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true } });
        if (!venue) throw new AppError(404, 'Không tìm thấy cơ sở');
        if (favorite) {
            await prisma.customerFavoriteVenue.upsert({
                where: { customerId_venueId: { customerId, venueId } },
                create: { customerId, venueId },
                update: {},
            });
        } else {
            await prisma.customerFavoriteVenue.deleteMany({ where: { customerId, venueId } });
        }
        return this.get(customerId);
    },

    async setCourt(customerId: string, courtId: string, favorite: boolean) {
        const court = await prisma.court.findUnique({ where: { id: courtId }, select: { id: true } });
        if (!court) throw new AppError(404, 'Không tìm thấy sân');
        if (favorite) {
            await prisma.customerFavoriteCourt.upsert({
                where: { customerId_courtId: { customerId, courtId } },
                create: { customerId, courtId },
                update: {},
            });
        } else {
            await prisma.customerFavoriteCourt.deleteMany({ where: { customerId, courtId } });
        }
        return this.get(customerId);
    },
};
