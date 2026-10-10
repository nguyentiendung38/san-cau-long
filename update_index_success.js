const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');
code = code.replace(
  'if (data.success) {',
  'if (data.success) { openSnackbar({ type: "success", text: "Fetched " + (data.data.items || data.data).length + " venues" });'
);
fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
