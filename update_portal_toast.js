const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/pages/PortalPage.tsx', 'utf8');

code = code.replace(
    "if (paymentStatus === 'success') {\n            toast({\n                title: 'Đặt sân thành công!',\n                description: 'Thanh toán VNPay đã được xác nhận.',\n                variant: 'success',\n            });\n        } else if (paymentStatus === 'failed') {\n            toast({ title: 'Thanh toán VNPay thất bại hoặc bị hủy.', variant: 'error' });\n        } else {\n            return;\n        }",
    "if (paymentStatus === 'success') {\n            setTimeout(() => toast({\n                title: 'Thanh toán VNPAY thành công!',\n                description: 'Cảm ơn bạn. Đơn đặt sân đã được xác nhận.',\n                variant: 'success',\n            }), 300);\n        } else if (paymentStatus === 'failed') {\n            setTimeout(() => toast({ title: 'Thanh toán VNPay thất bại hoặc bị hủy.', variant: 'error' }), 300);\n        } else {\n            return;\n        }"
);

fs.writeFileSync('apps/frontend/src/pages/PortalPage.tsx', code);
console.log('Fixed toast timing');
