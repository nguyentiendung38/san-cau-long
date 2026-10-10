const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

code = code.replace(
  '<Text size="small" bold style={{ marginTop: "16px", marginBottom: "8px" }}>Khung giờ:</Text>',
  '<Text size="small" bold style={{ marginTop: "16px", marginBottom: "8px" }}>Giờ bắt đầu:</Text>'
);

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
