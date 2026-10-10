const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

const doubleOpen = `window.open(payData.payUrl, "_blank");
                  window.open(payData.payUrl, "_blank");`;

code = code.replace(doubleOpen, 'window.open(payData.payUrl, "_blank");');

// If there's openWebview, replace it too
code = code.replace(/openWebview\(\{ url: payData\.payUrl \}\);/g, 'window.open(payData.payUrl, "_blank");');

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
