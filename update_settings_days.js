const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/pages/SettingsPage.tsx', 'utf8');

code = code.replace(
  /\`Tất cả các ngày \(\\$\\{allDaysLabel\\}\)\`/g,
  `"Tất cả các ngày"`
);

code = code.replace(
  /pricingForm\.dayOfWeek \? dayOfWeekLabels\[pricingForm\.dayOfWeek\] \|\| pricingForm\.dayOfWeek : allDaysLabel/g,
  'pricingForm.dayOfWeek ? dayOfWeekLabels[pricingForm.dayOfWeek] || pricingForm.dayOfWeek : "Tất cả các ngày"'
);

fs.writeFileSync('apps/frontend/src/pages/SettingsPage.tsx', code);
