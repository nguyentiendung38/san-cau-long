const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/pages/PortalPage.tsx', 'utf8');

const regex = /if \(paymentStatus === 'success'\) \{[\s\S]*?\} else if \(paymentStatus === 'failed'\) \{[\s\S]*?\} else \{/;

const replacement = `if (paymentStatus === 'success') {
            setTimeout(() => toast({
                title: 'Thanh toán VNPAY thành công!',
                description: 'Cảm ơn bạn. Đơn đặt sân đã được xác nhận.',
                variant: 'success',
            }), 300);
        } else if (paymentStatus === 'failed') {
            setTimeout(() => toast({ title: 'Thanh toán VNPay thất bại hoặc bị hủy.', variant: 'error' }), 300);
        } else {`;

code = code.replace(regex, replacement);

fs.writeFileSync('apps/frontend/src/pages/PortalPage.tsx', code);
console.log('Fixed toast timing');
