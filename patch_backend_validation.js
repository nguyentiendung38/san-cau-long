const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/services/booking.service.ts', 'utf8');

const regex = /const pricing = await this\.calculatePrice\([\s\S]*?\);/m;
const replacement = `const pricing = await this.calculatePrice(
            input.courtId,
            new Date(input.date),
            input.startTime,
            input.endTime
        );
        
        if (pricing.total === 0 && pricing.appliedRule === 'Chưa thiết lập giá') {
            throw new AppError(400, 'Khung giờ này ngoài giờ hoạt động (chưa thiết lập giá)');
        }`;

code = code.replace(regex, replacement);
fs.writeFileSync('apps/backend/src/services/booking.service.ts', code);
