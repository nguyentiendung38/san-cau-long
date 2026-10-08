const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/components/calendar/WeekView.tsx', 'utf8');

code = code.replace("const dateKey = new Date(booking.date).toISOString().split('T')[0];", 
    "const bd = new Date(booking.date);\n            const dateKey = `${bd.getFullYear()}-${String(bd.getMonth()+1).padStart(2, '0')}-${String(bd.getDate()).padStart(2, '0')}`;");

code = code.replace("const dateKey = date.toISOString().split('T')[0];", 
    "const dateKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;");

fs.writeFileSync('apps/frontend/src/components/calendar/WeekView.tsx', code);
