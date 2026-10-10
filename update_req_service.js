const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/services/booking-request.service.ts', 'utf8');

const oldStr = `                paymentStatus: request.paymentStatus,
                paymentAmount: request.paymentAmount,
                paymentProof: request.paymentProof,`;

const newStr = `                paymentStatus: request.paymentStatus,
                paymentAmount: request.paymentStatus === 'PAID' ? request.paymentAmount : 0,
                paymentProof: request.paymentProof,`;

code = code.replace(oldStr, newStr);

fs.writeFileSync('apps/backend/src/services/booking-request.service.ts', code);
