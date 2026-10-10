const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/routes/venue.routes.ts', 'utf8');

const regex = /\/:id\/availability', async \(req: Request, res: Response, next: NextFunction\) => \{[\s\S]*?catch \(error\) \{/m;

const newEndpoint = `/:id/availability', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { date } = req.query;
        const targetDate = date ? new Date(date as string) : new Date();
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();

        const courts = await prisma.court.findMany({
            where: { venueId: req.params.id, status: { not: 'INACTIVE' } },
            orderBy: { sortOrder: 'asc' }
        });

        const bookings = await prisma.booking.findMany({
            where: {
                courtId: { in: courts.map((c: any) => c.id) },
                date: { gte: startOfDay, lte: endOfDay },
                status: { notIn: ['CANCELLED', 'COMPLETED'] }
            }
        });

        const fifteenMinsAgo = new Date(Date.now() - 15 * 60000);
        const pendingRequests = await prisma.bookingRequest.findMany({
            where: {
                courtId: { in: courts.map((c: any) => c.id) },
                date: { gte: startOfDay, lte: endOfDay },
                status: 'PENDING',
                OR: [
                    { paymentMethod: { not: 'VNPAY' } },
                    { createdAt: { gte: fifteenMinsAgo } }
                ]
            }
        });

        const allBlockedSlots = [...bookings, ...pendingRequests];

        res.json({
            success: true,
            data: { courts, bookings: allBlockedSlots }
        });
    } catch (error) {`;

code = code.replace(regex, newEndpoint);

fs.writeFileSync('apps/backend/src/routes/venue.routes.ts', code);
