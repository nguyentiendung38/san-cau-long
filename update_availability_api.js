const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/routes/venue.routes.ts', 'utf8');

const oldAvailability = `const bookings = await prisma.booking.findMany({
            where: {
                courtId: { in: courts.map((c: any) => c.id) },
                date: { gte: startOfDay, lte: endOfDay },
                status: { not: 'CANCELLED' }
            }
        });

        res.json({`;

const newAvailability = `const bookings = await prisma.booking.findMany({
            where: {
                courtId: { in: courts.map((c: any) => c.id) },
                date: { gte: startOfDay, lte: endOfDay },
                status: { not: 'CANCELLED' }
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

        res.json({`;

code = code.replace(oldAvailability, newAvailability);

code = code.replace(`data: { courts, bookings }`, `data: { courts, bookings: allBlockedSlots }`);

fs.writeFileSync('apps/backend/src/routes/venue.routes.ts', code);
