const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/services/booking.service.ts', 'utf8');

const oldCode = `status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] },`;
const newCode = `status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },`;

code = code.replace(oldCode, newCode);

fs.writeFileSync('apps/backend/src/services/booking.service.ts', code);
