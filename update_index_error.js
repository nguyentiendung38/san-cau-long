const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');
code = code.replace(
  'console.error("Lỗi lấy dữ liệu sân:", err);',
  'console.error("Lỗi lấy dữ liệu sân:", err); openSnackbar({ type: "warning", text: "Fetch Error: " + err.message });'
);
fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
