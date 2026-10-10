const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/services/booking-request.service.ts', 'utf8');

const validationCode = `
        const dateObj = new Date(data.date);
        const dayNum = dateObj.getDay(); 
        const operatingHours = await prisma.operatingHour.findMany({
            where: { venueId: data.venueId, isActive: true }
        });
        
        if (operatingHours.length > 0) {
            let isOpen = false;
            let validStart = '';
            let validEnd = '';
            
            for (const oh of operatingHours) {
                if (oh.daysOfWeek && oh.daysOfWeek.includes(dayNum.toString())) {
                    isOpen = true;
                    validStart = oh.startTime;
                    validEnd = oh.endTime;
                    break;
                }
            }
            
            if (!isOpen) {
                throw new AppError(400, 'Cơ sở không hoạt động vào ngày bạn chọn.');
            }
            
            if (data.startTime < validStart || data.endTime > validEnd) {
                throw new AppError(400, \`Cơ sở chỉ mở cửa từ \${validStart} đến \${validEnd} vào ngày này.\`);
            }
        }`;

code = code.replace(
  /const \[startH\] = data\.startTime\.split\(':'\)\.map\(Number\);[\s\S]*?throw new AppError\(400, `Sân mở cửa từ \$\{court\.venue\.openTime\} đến \$\{court\.venue\.closeTime\}`\);\s*\}/,
  validationCode
);

fs.writeFileSync('apps/backend/src/services/booking-request.service.ts', code);
