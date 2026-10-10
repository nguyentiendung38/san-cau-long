const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/availability.tsx', 'utf8');

code = code.replace(/\\n/g, '\n');

fs.writeFileSync('apps/zalo-app/src/pages/availability.tsx', code);
