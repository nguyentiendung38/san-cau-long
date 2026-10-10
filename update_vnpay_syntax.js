const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/routes/vnpay.routes.ts', 'utf8');

code = code.replace(/\\n/g, '\n');

fs.writeFileSync('apps/backend/src/routes/vnpay.routes.ts', code);
