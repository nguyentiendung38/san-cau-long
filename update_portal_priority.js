const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/pages/PortalBookingVisual.tsx', 'utf8');

const oldLogic = "        if (dateStr === nowStr && time < nowTime) return 'past';\\n" +
"        \\n" +
"        const isBooked = bookings.some(b => \\n" +
"            b.courtId === selectedCourt.id && \\n" +
"            b.startTime <= time && \\n" +
"            b.endTime > time\\n" +
"        );\\n" +
"        if (isBooked) return 'booked';";

const newLogic = "        const isBooked = bookings.some(b => \\n" +
"            b.courtId === selectedCourt.id && \\n" +
"            b.startTime <= time && \\n" +
"            b.endTime > time\\n" +
"        );\\n" +
"        if (isBooked) return 'booked';\\n" +
"\\n" +
"        if (dateStr === nowStr && time < nowTime) return 'past';";

code = code.replace(oldLogic, newLogic);

const oldClass = 'status === \\'booked\\' && "bg-red-50 text-red-500 border-red-200 cursor-not-allowed"';
const newClass = 'status === \\'booked\\' && (dateStr === nowStr && time < nowTime || dateStr < nowStr ? "bg-red-50 text-red-500 border-red-200 opacity-60 cursor-not-allowed" : "bg-red-50 text-red-500 border-red-200 cursor-not-allowed")';

code = code.replace(oldClass, newClass);

fs.writeFileSync('apps/frontend/src/pages/PortalBookingVisual.tsx', code);
