const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/routes/vnpay.routes.ts', 'utf8');

// 1. In create-payment, extract 'source' from req.body and append to vnp_ReturnUrl
code = code.replace(
    "const { amount, orderId, bankCode } = req.body;",
    "const { amount, orderId, bankCode, source } = req.body;"
);

code = code.replace(
    "const vnp_ReturnUrl = process.env.VNPAY_RETURN_URL?.trim() || 'http://localhost:3000/api/vnpay/callback';",
    "const baseUrl = process.env.VNPAY_RETURN_URL?.trim() || 'http://localhost:3000/api/vnpay/callback';\n        const vnp_ReturnUrl = source === 'zalo' ? `${baseUrl}?source=zalo` : baseUrl;"
);

// 2. In callback, check for source and redirect if not zalo
code = code.replace(
    "const verify = vnpay.verifyReturnUrl(req.query as any);",
    "const source = req.query.source;\n        const verify = vnpay.verifyReturnUrl(req.query as any);"
);

code = code.replace(
    "res.setHeader(\"Content-Security-Policy\", \"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-hashes'; style-src 'self' 'unsafe-inline';\");\n            return res.send(successHtml);",
    "if (source === 'zalo') {\n                res.setHeader(\"Content-Security-Policy\", \"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-hashes'; style-src 'self' 'unsafe-inline';\");\n                return res.send(successHtml);\n            } else {\n                return res.redirect(`${frontendUrl}/trang-chu?payment=success`);\n            }"
);

code = code.replace(
    "res.setHeader(\"Content-Security-Policy\", \"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-hashes'; style-src 'self' 'unsafe-inline';\");\n            return res.send(failedHtml);",
    "if (source === 'zalo') {\n                res.setHeader(\"Content-Security-Policy\", \"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-hashes'; style-src 'self' 'unsafe-inline';\");\n                return res.send(failedHtml);\n            } else {\n                return res.redirect(`${frontendUrl}/trang-chu?payment=failed`);\n            }"
);

fs.writeFileSync('apps/backend/src/routes/vnpay.routes.ts', code);
console.log('Fixed vnpay callback!');
