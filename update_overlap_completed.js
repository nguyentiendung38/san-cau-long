const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/services/booking-request.service.ts', 'utf8');

code = code.replace(/status: \{ not: 'CANCELLED' \}/g, "status: { notIn: ['CANCELLED', 'COMPLETED'] }");

fs.writeFileSync('apps/backend/src/services/booking-request.service.ts', code);
