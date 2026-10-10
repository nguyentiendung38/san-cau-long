const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/history.tsx', 'utf8');

code = code.replace(
  /\/booking-requests\/public\/history\?phone=/g, 
  '/booking-requests/public/my-requests?phone='
);

fs.writeFileSync('apps/zalo-app/src/pages/history.tsx', code);
