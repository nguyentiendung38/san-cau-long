const fs = require('fs');
let content = fs.readFileSync('apps/frontend/src/pages/SettingsPage.tsx', 'utf8');

const importLine = "import { pricingRuleApi, PricingRule } from '@/services/inventory.service';";
const newImport = importLine + "\r\nimport { customerApi } from '@/services/customer.service';";

content = content.replace(importLine, newImport);

fs.writeFileSync('apps/frontend/src/pages/SettingsPage.tsx', content, 'utf8');
console.log('Done. customerApi import present:', content.includes("import { customerApi }"));
