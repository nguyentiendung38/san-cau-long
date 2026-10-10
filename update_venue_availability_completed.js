const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/routes/venue.routes.ts', 'utf8');

const oldAvailability = `status: { not: 'CANCELLED' }`;
const newAvailability = `status: { notIn: ['CANCELLED', 'COMPLETED'] }`;

// It occurs multiple times? Let's use global replace or exact match
code = code.replace(/status: \{ not: 'CANCELLED' \}/g, newAvailability);

fs.writeFileSync('apps/backend/src/routes/venue.routes.ts', code);
