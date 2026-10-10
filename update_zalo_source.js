const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

const oldStr = `               body: JSON.stringify({
                  orderId: data.data.id,
                  amount: data.data.paymentAmount || 100000
               })`;

const newStr = `               body: JSON.stringify({
                  orderId: data.data.id,
                  amount: data.data.paymentAmount || 100000,
                  source: 'zalo'
               })`;

if (!code.includes(oldStr)) {
    console.error("Match failed!");
    // Try regex
    code = code.replace(/amount: data\.data\.paymentAmount \|\| 100000/, "amount: data.data.paymentAmount || 100000,\n                  source: 'zalo'");
} else {
    code = code.replace(oldStr, newStr);
}

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
console.log('Fixed zalo app index.tsx properly');
