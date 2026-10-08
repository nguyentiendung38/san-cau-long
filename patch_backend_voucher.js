const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/services/booking.service.ts', 'utf8');

code = code.replace(/notes\?: string;/g, 'notes?: string;\n    voucherCode?: string;\n    discountAmount?: number;');

const regex = /let finalTotalAmount = pricing\.total;[\s\S]*?if \(input\.orderedItems\) \{/m;
const replacement = `let finalTotalAmount = pricing.total;
        
        if (input.voucherCode && input.discountAmount) {
            finalTotalAmount = Math.max(0, finalTotalAmount - input.discountAmount);
            input.notes = input.notes ? input.notes + '\\nÁp dụng voucher: ' + input.voucherCode + ' (-' + input.discountAmount + 'đ)' : 'Áp dụng voucher: ' + input.voucherCode + ' (-' + input.discountAmount + 'đ)';
            
            // Increment voucher usage
            try {
                await prisma.voucher.update({
                    where: { code: input.voucherCode },
                    data: { usageCount: { increment: 1 } }
                });
            } catch (e) {}
        }

        if (input.orderedItems) {`;

code = code.replace(regex, replacement);
fs.writeFileSync('apps/backend/src/services/booking.service.ts', code);
