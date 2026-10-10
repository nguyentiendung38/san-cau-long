const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

const replacement = `
            openSnackbar({ type: "success", text: "Chuyển hướng đến cổng thanh toán VNPAY..." });
            const paymentWindow = window.open(data.data.payUrl, '_blank');
            if (paymentWindow) {
                const checkWindowClosed = setInterval(() => {
                    if (paymentWindow.closed) {
                        clearInterval(checkWindowClosed);
                        openSnackbar({ type: "success", text: "Thanh toán hoàn tất. Lịch đã được tự động đặt!" });
                        setShowBookingModal(false);
                    }
                }, 1000);
            }
`;

code = code.replace(/openSnackbar\(\{\s*type: "success",\s*text: "Chuyển hướng đến cổng thanh toán VNPAY\.\.\."\s*\}\);\s*window\.open\(data\.data\.payUrl, '_blank'\);/, replacement);

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
