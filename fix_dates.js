const fs = require('fs');

const fix = (file) => {
    if (!fs.existsSync(file)) return;
    let code = fs.readFileSync(file, 'utf8');
    // Replace `new \`${Date()...}` with `` `${new Date()...}` ``
    code = code.replace(/new\s+`\$\{Date\(\)\.getFullYear\(\)\}-\$\{String\(Date\(\)\.getMonth\(\)\+1\)\.padStart\(2, '0'\)\}-\$\{String\(Date\(\)\.getDate\(\)\)\.padStart\(2, '0'\)\}`/g, 
        "`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`");
    
    // Also export.service.ts had `new Date(...)` wrapped incorrectly
    // Because of `new Date(Date.now() - ...).toISOString()`
    // The regex `([a-zA-Z0-9_\(\)\.?]+)` probably only matched `1000)` or something.
    // Let's just fix export.service.ts by reverting it and using a safer replace.
    fs.writeFileSync(file, code);
}

const files = [
    'apps/frontend/src/components/booking/NewBookingModal.tsx',
    'apps/frontend/src/components/booking/RecurringBookingModal.tsx',
    'apps/frontend/src/components/portal/VisualBookingModal.tsx',
    'apps/frontend/src/components/public/PublicBookingForm.tsx',
    'apps/frontend/src/components/reports/ExportReportModal.tsx',
    'apps/frontend/src/pages/InvoicesPage.tsx',
    'apps/frontend/src/services/export.service.ts'
];

files.forEach(fix);
