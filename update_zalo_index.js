const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

code = code.replace(
    "orderId: data.data.id,\n                 amount: data.data.paymentAmount || 100000",
    "orderId: data.data.id,\n                 amount: data.data.paymentAmount || 100000,\n                 source: 'zalo'"
);

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
console.log('Fixed zalo app index.tsx');
