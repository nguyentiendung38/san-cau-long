const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/routes/vnpay.routes.ts', 'utf8');

code = code.replace(
  'return res.send(`<h1>Thanh toán thất bại!</h1><p>Lỗi: ${error.message}</p>`);',
  `if (req.query && req.query.vnp_TxnRef) {
            const orderId = req.query.vnp_TxnRef.split('-')[0];
            await bookingRequestService.updatePaymentStatus(orderId, 'FAILED').catch(() => {});
        }
        return res.send(\`<h1>Thanh toán thất bại!</h1><p>Lỗi: \${error.message}</p>\`);`
);

fs.writeFileSync('apps/backend/src/routes/vnpay.routes.ts', code);
