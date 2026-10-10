const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

code = code.replace(/<\/select>\s*\)\)\}\s*<\/div>/, '</select>');

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
