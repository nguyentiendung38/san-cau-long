const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/services/invoice.service.ts', 'utf8');

const regex = /paidAmount: paidAmount !== undefined \? paidAmount : \(paymentStatus === 'PAID' \? existing\.total : existing\.paidAmount\)/m;
const replacement = "paidAmount: paidAmount !== undefined ? paidAmount : (paymentStatus === 'PAID' ? Math.max(0, existing.total - (existing.depositAmount || 0)) : existing.paidAmount)";

code = code.replace(regex, replacement);
fs.writeFileSync('apps/backend/src/services/invoice.service.ts', code);
