const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/pages/PortalBookingVisual.tsx', 'utf8');

const oldStr = `          if (dateStr === nowStr && time < nowTime) return 'past';`;
const newStr = `          if (dateStr < nowStr || (dateStr === nowStr && time < nowTime)) return 'past';`;

code = code.replace(oldStr, newStr);

fs.writeFileSync('apps/frontend/src/pages/PortalBookingVisual.tsx', code);
console.log('Fixed Web Portal past logic');
