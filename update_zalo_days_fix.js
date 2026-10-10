const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/index.tsx', 'utf8');

const oldTranslate = `const translateDays = (daysStr: string) => {
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
  };`;

const newTranslate = `const translateDays = (daysStr: string) => {
    if (!daysStr) return "Tất cả các ngày";
    
    if (daysStr.startsWith('[')) {
      try {
        const arr = JSON.parse(daysStr);
        const numMap: any = { 0: 'CN', 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7' };
        if (arr.length === 7) return "Tất cả các ngày";
        
        // Sort specifically: T2 -> T7, then CN
        const sorted = arr.sort((a: number, b: number) => {
           if (a === 0) return 1;
           if (b === 0) return -1;
           return a - b;
        });
        return sorted.map((n: number) => numMap[n]).join(', ');
      } catch (e) { }
    }

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
  };`;

// Use replace with a regular expression ignoring exact whitespace matching
code = code.replace(
  /const translateDays = \(daysStr: string\) => \{[\s\S]*?return daysStr\.split\(\',\('\)\.map\(d => map\[d\.trim\(\)\] \|\| d\)\.join\(\', \'\);\s*\};/m,
  newTranslate
);

// Fallback if regex fails:
if (!code.includes("JSON.parse")) {
  code = code.replace(/const translateDays = \(daysStr: string\) => \{[\s\S]+?\}\s*;/m, newTranslate);
}

fs.writeFileSync('apps/zalo-app/src/pages/index.tsx', code);
