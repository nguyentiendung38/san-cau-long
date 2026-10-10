const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/pages/PortalBookingVisual.tsx', 'utf8');

const regex = /visibleSlots\.map\(\(time\) => \{[\s\S]*?const status = getSlotStatus\(time\);/;

code = code.replace(
    regex,
    "visibleSlots.map((time) => {\n                                                    const status = getSlotStatus(time);\n                                                    const dateStr = format(selectedDate, 'yyyy-MM-dd');\n                                                    const now = new Date();\n                                                    const nowStr = format(now, 'yyyy-MM-dd');\n                                                    const nowTime = format(now, 'HH:mm');"
);

fs.writeFileSync('apps/frontend/src/pages/PortalBookingVisual.tsx', code);
console.log('Fixed ReferenceError');
