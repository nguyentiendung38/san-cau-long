const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

const replacement = `
              if (payData.success && payData.payUrl) {
                 openSnackbar({ type: "success", text: "Chuyển hướng VNPAY..." });
                 const paymentWindow = window.open(payData.payUrl, "_blank");
                 if (paymentWindow) {
                     const checkWindowClosed = setInterval(() => {
                         if (paymentWindow.closed) {
                             clearInterval(checkWindowClosed);
                             openSnackbar({ type: "success", text: "Thanh toán hoàn tất. Lịch đã được tự động đặt!" });
                             setShowBookingModal(false);
                         }
                     }, 1000);
                 }
              } else {
`;

code = code.replace(/if \(payData\.success && payData\.payUrl\) \{\s*window\.open\(payData\.payUrl, "_blank"\);\s*\} else \{/, replacement);

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
