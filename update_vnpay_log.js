const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/routes/vnpay.routes.ts', 'utf8');

code = code.replace(
  'const verify = vnpay.verifyReturnUrl(req.query as any);',
  `const verify = vnpay.verifyReturnUrl(req.query as any);
  console.log('VNPAY CALLBACK:', verify, req.query);`
);

code = code.replace(
  'return res.redirect(`${frontendUrl}/trang-chu?payment=success`);',
  'return res.send(`<h1>Thanh toán thành công!</h1><p>Bạn có thể đóng trang này để quay lại Zalo App.</p>`);'
);
code = code.replace(
  'return res.redirect(`${frontendUrl}/trang-chu?payment=failed`);',
  'return res.send(`<h1>Thanh toán thất bại!</h1><p>Bạn có thể đóng trang này để quay lại Zalo App.</p>`);'
);

fs.writeFileSync('apps/backend/src/routes/vnpay.routes.ts', code);
