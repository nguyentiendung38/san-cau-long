const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/routes/vnpay.routes.ts', 'utf8');

const successHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Thanh toán thành công</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f3f4f6; }
        .box { background: white; padding: 32px; border-radius: 16px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 90%; width: 320px; }
        .icon { color: #10b981; font-size: 64px; line-height: 1; margin-bottom: 16px; }
        .title { font-size: 20px; font-weight: bold; margin-bottom: 8px; color: #111827; }
        .desc { color: #6b7280; margin-bottom: 24px; font-size: 15px; }
        .btn { background: #006af5; color: white; border: none; padding: 14px 24px; border-radius: 8px; font-size: 16px; cursor: pointer; width: 100%; font-weight: 500; display: block; text-decoration: none; }
    </style>
</head>
<body>
    <div class="box">
        <div class="icon">✓</div>
        <div class="title">Thanh toán thành công!</div>
        <div class="desc">Cảm ơn bạn. Đơn đặt sân đã được xác nhận.</div>
        <button class="btn" onclick="window.close()">Đóng & Quay lại</button>
    </div>
    <script>
        setTimeout(() => { window.close(); }, 3000);
    </script>
</body>
</html>
`;

const failedHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Thanh toán thất bại</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f3f4f6; }
        .box { background: white; padding: 32px; border-radius: 16px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 90%; width: 320px; }
        .icon { color: #ef4444; font-size: 64px; line-height: 1; margin-bottom: 16px; }
        .title { font-size: 20px; font-weight: bold; margin-bottom: 8px; color: #111827; }
        .desc { color: #6b7280; margin-bottom: 24px; font-size: 15px; }
        .btn { background: #006af5; color: white; border: none; padding: 14px 24px; border-radius: 8px; font-size: 16px; cursor: pointer; width: 100%; font-weight: 500; display: block; text-decoration: none; }
    </style>
</head>
<body>
    <div class="box">
        <div class="icon">✗</div>
        <div class="title">Thanh toán thất bại!</div>
        <div class="desc">Giao dịch không thành công hoặc đã bị hủy.</div>
        <button class="btn" onclick="window.close()">Đóng & Quay lại</button>
    </div>
</body>
</html>
`;

code = code.replace(
  /return res\.send\(`<h1>Thanh toAn thAnh cA'ng!<\/h1>[^`]+`\);/,
  `return res.send(\`${successHtml}\`);`
);

code = code.replace(
  /return res\.send\(`<h1>Thanh toAn tht bi!<\/h1>[^`]+`\);/,
  `return res.send(\`${failedHtml}\`);`
);

// also check if utf8 issues caused literal A
code = code.replace(/Thanh toAn thAnh cA'ng/g, 'Thanh toan thanh cong');

fs.writeFileSync('apps/backend/src/routes/vnpay.routes.ts', code);
