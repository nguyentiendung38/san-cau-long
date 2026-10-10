const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/services/booking-request.service.ts', 'utf8');

const oldStr = `        const { BookingService } = await import('./booking.service.js');
        const bookingService = new BookingService();
        const pricing = await bookingService.calculatePrice(data.courtId, new Date(data.date), data.startTime, data.endTime);
        let paymentAmount = pricing.total;`;

const newStr = `        const { BookingService } = await import('./booking.service.js');
        const bookingService = new BookingService();
        
        // Validation check for operating hours and pricing
        const court = await prisma.court.findUnique({
            where: { id: data.courtId },
            include: { venue: true }
        });
        if (!court) throw new AppError(404, 'Không tìm thấy sân');
        
        const [startH] = data.startTime.split(':').map(Number);
        const [endH] = data.endTime.split(':').map(Number);
        const [venueOpenH] = (court.venue.openTime || '05:00').split(':').map(Number);
        const [venueCloseH] = (court.venue.closeTime || '22:00').split(':').map(Number);
        
        if (startH < venueOpenH || endH > venueCloseH) {
            throw new AppError(400, \`Sân mở cửa từ \${court.venue.openTime} đến \${court.venue.closeTime}\`);
        }
        
        const pricing = await bookingService.calculatePrice(data.courtId, new Date(data.date), data.startTime, data.endTime);
        if (pricing.total <= 0 || pricing.appliedRule?.startsWith('Chưa thiết lập giá')) {
            throw new AppError(400, 'Khung giờ này ngoài giờ hoạt động (chưa thiết lập giá)');
        }
        
        let paymentAmount = pricing.total;`;

code = code.replace(oldStr, newStr);

fs.writeFileSync('apps/backend/src/services/booking-request.service.ts', code);
