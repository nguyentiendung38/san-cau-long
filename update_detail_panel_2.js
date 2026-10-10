const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/components/booking/BookingDetailPanel.tsx', 'utf8');

code = code.replace(
  /<span>Đã cọc \(Khách chuyển khoản\):<\/span>/g, 
  "<span>{booking.paymentMethod === 'VNPAY' ? 'Đã thanh toán (VNPAY):' : 'Đã cọc (Khách chuyển khoản):'}</span>"
);

code = code.replace(
  /<div className="flex items-center justify-between text-error font-bold mt-1">[\s\S]*?<span>Cần thu thêm:<\/span>[\s\S]*?<span className="text-base">\{formatCurrency\(Math\.max\(0, booking\.totalAmount - booking\.paymentAmount!\)\)\}<\/span>[\s\S]*?<\/div>/g,
  `{Math.max(0, booking.totalAmount - booking.paymentAmount!) > 0 && (<div className="flex items-center justify-between text-error font-bold mt-1"><span>Cần thu thêm:</span><span className="text-base">{formatCurrency(Math.max(0, booking.totalAmount - booking.paymentAmount!))}</span></div>)}`
);

fs.writeFileSync('apps/frontend/src/components/booking/BookingDetailPanel.tsx', code);
