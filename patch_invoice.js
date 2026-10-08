const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/services/invoice.service.ts', 'utf8');

const regex = /const invoice = await prisma\.invoice\.create\(\{([\s\S]*?)paymentStatus: paymentStatus \|\| 'PENDING',/m;
const replacement = `let finalPaymentStatus = paymentStatus || 'PENDING';
        if (finalPaymentStatus === 'PAID' && (depositAmount || 0) + (paidAmount || 0) < total && total > 0) {
            finalPaymentStatus = 'PENDING';
        }

        // Create invoice
        const invoice = await prisma.invoice.create({$1paymentStatus: finalPaymentStatus,`;

code = code.replace(regex, replacement);
fs.writeFileSync('apps/backend/src/services/invoice.service.ts', code);
