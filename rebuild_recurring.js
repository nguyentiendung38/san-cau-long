const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/components/booking/RecurringBookingModal.tsx', 'utf8');

// 1. Timezone Fix
code = code.replace(/([a-zA-Z0-9_\(\)\.?]+)\.toISOString\(\)\.split\('T'\)\[0\]/g, (match, p1) => {
    return `\`\${${p1}.getFullYear()}-\${String(${p1}.getMonth()+1).padStart(2, '0')}-\${String(${p1}.getDate()).padStart(2, '0')}\``;
});
code = code.replace(/new\s+`\$\{Date\(\)\.getFullYear\(\)\}-\$\{String\(Date\(\)\.getMonth\(\)\+1\)\.padStart\(2, '0'\)\}-\$\{String\(Date\(\)\.getDate\(\)\)\.padStart\(2, '0'\)\}`/g, 
    "`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`");

// 2. Input Time Fixes
const timeStartRegex = /<select\s*value=\{formData\.startTime\}[\s\S]*?<\/select>/m;
const timeStartRep = `<input
                                type="time"
                                value={formData.startTime}
                                onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                                className={cn(
                                    "w-full bg-background-tertiary border rounded-lg px-3 py-2.5 text-foreground",
                                    "focus:outline-none focus:ring-2 focus:ring-primary-500",
                                    errors.startTime ? 'border-red-500' : 'border-border'
                                )}
                            />`;
code = code.replace(timeStartRegex, timeStartRep);

const timeEndRegex = /<select\s*value=\{formData\.endTime\}[\s\S]*?<\/select>/m;
const timeEndRep = `<input
                                type="time"
                                value={formData.endTime}
                                onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                                className={cn(
                                    "w-full bg-background-tertiary border rounded-lg px-3 py-2.5 text-foreground",
                                    "focus:outline-none focus:ring-2 focus:ring-primary-500",
                                    errors.endTime ? 'border-red-500' : 'border-border'
                                )}
                            />`;
code = code.replace(timeEndRegex, timeEndRep);

fs.writeFileSync('apps/frontend/src/components/booking/RecurringBookingModal.tsx', code);
