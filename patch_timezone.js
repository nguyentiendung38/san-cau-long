const fs = require('fs');

function fixTimezone(filePath) {
    if (!fs.existsSync(filePath)) return;
    let code = fs.readFileSync(filePath, 'utf8');
    
    // Custom replacer function to avoid regex escaping hell
    const fixDate = (str) => {
        return str.replace(/([a-zA-Z0-9_\(\)\.?]+)\.toISOString\(\)\.split\('T'\)\[0\]/g, (match, p1) => {
            return `\`\${${p1}.getFullYear()}-\${String(${p1}.getMonth()+1).padStart(2, '0')}-\${String(${p1}.getDate()).padStart(2, '0')}\``;
        });
    };

    code = fixDate(code);
    fs.writeFileSync(filePath, code);
}

fixTimezone('apps/frontend/src/components/booking/NewBookingModal.tsx');
fixTimezone('apps/frontend/src/components/booking/RecurringBookingModal.tsx');
fixTimezone('apps/frontend/src/components/portal/VisualBookingModal.tsx');
fixTimezone('apps/frontend/src/components/public/PublicBookingForm.tsx');
fixTimezone('apps/frontend/src/components/reports/ExportReportModal.tsx');
fixTimezone('apps/frontend/src/pages/InvoicesPage.tsx');
fixTimezone('apps/frontend/src/services/export.service.ts');

