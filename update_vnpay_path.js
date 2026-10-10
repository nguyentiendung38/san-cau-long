const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/routes/vnpay.routes.ts', 'utf8');

// Update create-payment
code = code.replace(
    "const baseUrl = process.env.VNPAY_RETURN_URL?.trim() || 'http://localhost:3000/api/vnpay/callback';\n        const vnp_ReturnUrl = source === 'zalo' ? `${baseUrl}?source=zalo` : baseUrl;",
    "const baseUrl = process.env.VNPAY_RETURN_URL?.trim() || 'http://localhost:3000/api/vnpay/callback';\n        const vnp_ReturnUrl = source === 'zalo' ? baseUrl.replace('/callback', '/callback/zalo') : baseUrl;"
);

// Update callback route
code = code.replace(
    "router.get('/callback', async (req: Request, res: Response, next: NextFunction) => {\n    try {\n        const source = req.query.source;",
    "router.get(['/callback', '/callback/:source'], async (req: Request, res: Response, next: NextFunction) => {\n    try {\n        const source = req.params.source || req.query.source;"
);

fs.writeFileSync('apps/backend/src/routes/vnpay.routes.ts', code);
console.log('Fixed VNPAY callback path');
