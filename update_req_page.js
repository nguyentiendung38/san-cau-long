const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/pages/BookingRequestsPage.tsx', 'utf8');

const oldStr = "`Thanh toán QR · ${req.paymentStatus === 'PAID' ? 'Đã xác nhận' : 'Chờ kiểm tra'}`";
const newStr = "(req.paymentStatus === 'PAID' ? 'Thanh toán QR · Đã xác nhận' : 'Chưa thanh toán · Chờ kiểm tra')";

code = code.replace(oldStr, newStr);

fs.writeFileSync('apps/frontend/src/pages/BookingRequestsPage.tsx', code);
