const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

const newSubmitCode = `
    const [h, m] = bookingTime.split(':');
    let minute = parseInt(m);
    if (minute % 30 !== 0) {
       openSnackbar({ type: "warning", text: "Phút phải là chẵn (00 hoặc 30). Ví dụ: 14:00, 14:30" });
       return;
    }
    const endH = parseInt(h) + 1;
    const endTime = \`\${endH.toString().padStart(2, '0')}:\${m}\`;
`;

code = code.replace(
    /const \[h, m\] = bookingTime\.split\(':'\);\s*const endH = parseInt\(h\) \+ 1;\s*const endTime = `\$\{endH\.toString\(\)\.padStart\(2, '0'\)\}:\$\{m\}`;/g,
    newSubmitCode
);

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
