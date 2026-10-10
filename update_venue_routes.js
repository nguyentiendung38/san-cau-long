const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/routes/venue.routes.ts', 'utf8');

code = code.replace(
    "status: { notIn: ['CANCELLED', 'COMPLETED'] }",
    "status: { not: 'CANCELLED' }"
);

fs.writeFileSync('apps/backend/src/routes/venue.routes.ts', code);
console.log('Fixed venue.routes.ts');
