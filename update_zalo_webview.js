const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

if (!code.includes('import { openWebview }')) {
    code = code.replace(
        'import { useNavigate } from "zmp-ui";',
        'import { useNavigate } from "zmp-ui";\nimport { openWebview } from "zmp-sdk";'
    );
}

code = code.replace(
    'window.location.href = payData.payUrl;',
    'openWebview({ url: payData.payUrl });'
);

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
