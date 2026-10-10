const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/routes/venue.routes.ts', 'utf8');

const oldCode = `        const bookings = await prisma.booking.findMany({
            where: {
                courtId: { in: courts.map((c: any) => c.id) },
                date: { gte: startOfDay, lte: endOfDay },
                status: { not: 'CANCELLED' }
            }
        });

        res.json({
            success: true,
            data: { courts, bookings }
        });`;

const newCode = `        const bookings = await prisma.booking.findMany({
            where: {
                courtId: { in: courts.map((c: any) => c.id) },
                date: { gte: startOfDay, lte: endOfDay },
                status: { not: 'CANCELLED' }
            }
        });

        const pendingRequests = await prisma.bookingRequest.findMany({
            where: {
                courtId: { in: courts.map((c: any) => c.id) },
                date: { gte: startOfDay, lte: endOfDay },
                status: 'PENDING'
            }
        });

        const combinedBookings = [
            ...bookings,
            ...pendingRequests.map((req: any) => ({
                id: req.id,
                courtId: req.courtId,
                customerId: 'pending-request',
                date: req.date,
                startTime: req.startTime,
                endTime: req.endTime,
                status: 'PENDING_REQUEST' // virtual status so the UI knows it's booked
            }))
        ];

        res.json({
            success: true,
            data: { courts, bookings: combinedBookings }
        });`;

code = code.replace(oldCode, newCode);

fs.writeFileSync('apps/backend/src/routes/venue.routes.ts', code);
