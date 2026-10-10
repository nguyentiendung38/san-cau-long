const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/package.json', 'utf8');

code = code.replace(/"start": "zmp start --force"/g, '"start": "zmp start"');

fs.writeFileSync('apps/zalo-app/package.json', code);
