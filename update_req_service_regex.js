const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/services/booking-request.service.ts', 'utf8');

code = code.replace(
    /paymentAmount:\s*request\.paymentAmount,/,
    "paymentAmount: request.paymentStatus === 'PAID' ? request.paymentAmount : 0,"
);

fs.writeFileSync('apps/backend/src/services/booking-request.service.ts', code);
