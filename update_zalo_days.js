const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

// 1. Add translateDays helper function inside the file (outside the component)
const helperCode = `
const translateDays = (daysStr: string) => {
  if (!daysStr) return "Tất cả các ngày";
  const map: any = {
    'MONDAY': 'T2',
    'TUESDAY': 'T3',
    'WEDNESDAY': 'T4',
    'THURSDAY': 'T5',
    'FRIDAY': 'T6',
    'SATURDAY': 'T7',
    'SUNDAY': 'CN'
  };
  return daysStr.split(',').map(d => map[d.trim()] || d).join(', ');
};

export default function HomePage() {
`;

code = code.replace('export default function HomePage() {', helperCode);

// 2. Update Operating Hours rendering
code = code.replace(
  /• Thứ \{oh\.daysOfWeek\}/g,
  '• {translateDays(oh.daysOfWeek)}'
);

// 3. Update Pricing Rules rendering to include the days
code = code.replace(
  /<Text size="xSmall">• \{pr\.name\} \(\{pr\.startTime\}-\{pr\.endTime\}\):<\/Text>/g,
  '<Text size="xSmall">• {pr.name} ({pr.startTime}-{pr.endTime}) [{translateDays(pr.dayOfWeek)}]:</Text>'
);

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
