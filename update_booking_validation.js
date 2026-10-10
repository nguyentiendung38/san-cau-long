const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/services/booking-request.service.ts', 'utf8');

const validationCode = `
        const dateObjStart = new Date(data.date);
        dateObjStart.setHours(0, 0, 0, 0);
        const dateObjEnd = new Date(data.date);
        dateObjEnd.setHours(23, 59, 59, 999);

        const existingBookings = await prisma.booking.findMany({
            where: {
                courtId: data.courtId,
                date: { gte: dateObjStart, lte: dateObjEnd },
                status: { not: 'CANCELLED' }
            }
        });

        const existingRequests = await prisma.bookingRequest.findMany({
            where: {
                courtId: data.courtId,
                date: { gte: dateObjStart, lte: dateObjEnd },
                status: 'PENDING'
            }
        });

        const isOverlap = (s1: string, e1: string, s2: string, e2: string) => {
            return s1 < e2 && s2 < e1;
        };

        for (const b of existingBookings) {
            if (isOverlap(data.startTime, data.endTime, b.startTime, b.endTime)) {
                throw new AppError(400, 'Khung giờ này đã có người đặt, vui lòng chọn giờ khác.');
            }
        }
        for (const r of existingRequests) {
            if (isOverlap(data.startTime, data.endTime, r.startTime, r.endTime)) {
                throw new AppError(400, 'Khung giờ này đang có người khác thực hiện đặt sân, vui lòng chọn giờ khác.');
            }
        }

        let paymentAmount = pricing.total;`;

code = code.replace(/let paymentAmount = pricing\.total;/, validationCode);

fs.writeFileSync('apps/backend/src/services/booking-request.service.ts', code);
