const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/availability.tsx', 'utf8');

code = code.replace(/\\`/g, '`');
code = code.replace(/\\\$/g, '$');
code = code.replace(/\\n  const isPassed/g, '\n  const isPassed');

fs.writeFileSync('apps/zalo-app/src/pages/availability.tsx', code);
