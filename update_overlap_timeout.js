const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/services/booking-request.service.ts', 'utf8');

const oldExistingRequests = `const existingRequests = await prisma.bookingRequest.findMany({
            where: {
                courtId: data.courtId,
                date: { gte: dateObjStart, lte: dateObjEnd },
                status: 'PENDING'
            }
        });`;

const newExistingRequests = `const fifteenMinsAgo = new Date(Date.now() - 15 * 60000);
        const existingRequests = await prisma.bookingRequest.findMany({
            where: {
                courtId: data.courtId,
                date: { gte: dateObjStart, lte: dateObjEnd },
                status: 'PENDING',
                OR: [
                    { paymentMethod: { not: 'VNPAY' } },
                    { createdAt: { gte: fifteenMinsAgo } }
                ]
            }
        });`;

code = code.replace(oldExistingRequests, newExistingRequests);
fs.writeFileSync('apps/backend/src/services/booking-request.service.ts', code);
