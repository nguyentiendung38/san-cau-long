const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/components/booking/NewBookingModal.tsx', 'utf8');

const regex = /if \(availability && !availability\.available\) \{\s*newErrors\.availability = 'Khung giờ này đã có người đặt';\s*\}/m;
const replacement = `if (availability && !availability.available) {
            newErrors.availability = 'Khung giờ này đã có người đặt';
        }

        if (pricing && pricing.total === 0 && pricing.appliedRule === 'Chưa thiết lập giá') {
            newErrors.availability = 'Khung giờ này ngoài giờ hoạt động (chưa có giá)';
        }`;

code = code.replace(regex, replacement);
fs.writeFileSync('apps/frontend/src/components/booking/NewBookingModal.tsx', code);
