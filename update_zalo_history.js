const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/history.tsx', 'utf8');

code = code.replace(
    'setBookings(data.data || []);',
    'const zaloBookings = (data.data || []).filter(b => b.notes && b.notes.includes("Zalo"));\n          setBookings(zaloBookings);'
);

fs.writeFileSync('apps/zalo-app/src/pages/history.tsx', code);
console.log('Fixed Zalo history filter');
