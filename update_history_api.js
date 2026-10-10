const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/routes/booking-request.routes.ts', 'utf8');

const historyEndpoint = `
// Public history
router.get('/public/history', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { phone } = req.query;
        if (!phone) {
            return res.json({ success: true, data: [] });
        }
        
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();

        // Find both BookingRequests and Bookings for this phone
        const requests = await prisma.bookingRequest.findMany({
            where: { phone: String(phone) },
            include: { venue: true, court: true },
            orderBy: { createdAt: 'desc' }
        });
        
        return res.json({ success: true, data: requests });
    } catch (error) {
        next(error);
    }
});

// Create booking request - PUBLIC
`;

code = code.replace(/\/\/ Create booking request - PUBLIC/, historyEndpoint);

fs.writeFileSync('apps/backend/src/routes/booking-request.routes.ts', code);
