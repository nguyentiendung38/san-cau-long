const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

code = code.replace(
    'openWebview({ url: payData.payUrl });',
    'try { openWebview({ url: payData.payUrl }); } catch(e) { window.open(payData.payUrl, "_blank"); }\n                  window.open(payData.payUrl, "_blank");'
);

// Actually let's just forcefully use window.open
code = code.replace(
    /try \{ openWebview.*_blank"\);\s*\}/g,
    'window.open(payData.payUrl, "_blank");'
);

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
