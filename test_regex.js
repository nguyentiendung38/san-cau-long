const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/availability.tsx', 'utf8');
const regex = /<Box className="bg-white p-4 rounded-xl shadow-sm overflow-x-auto">[\s\S]*?(?=<Box className="bg-white p-4 rounded-xl shadow-sm mt-4">)/;
console.log('Regex matched?', regex.test(code));
