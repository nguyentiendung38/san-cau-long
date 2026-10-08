const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/components/booking/NewBookingModal.tsx', 'utf8');

const regex = /\) : availability\?\.available \? \([\s\S]*?<Check className="w-5 h-5 text-green-500" \/>\s*<span className="text-green-400 text-sm">Khung giờ trống, có thể đặt<\/span>\s*<\/>\s*\) : \(/m;

const replacement = `) : pricing && pricing.total === 0 && pricing.appliedRule === 'Chưa thiết lập giá' ? (
                                <>
                                    <AlertCircle className="w-5 h-5 text-red-500" />
                                    <span className="text-red-400 text-sm">Ngoài giờ hoạt động (chưa thiết lập giá)</span>
                                </>
                            ) : availability?.available ? (
                                <>
                                    <Check className="w-5 h-5 text-green-500" />
                                    <span className="text-green-400 text-sm">Khung giờ trống, có thể đặt</span>
                                </>
                            ) : (`;

code = code.replace(regex, replacement);

// Also need to update the parent div classes to red if it's out of bounds
const classRegex = /className=\{cn\(\s*'flex items-center gap-3 p-3 rounded-lg border',\s*!availability\?.available \?\s*'border-red-500\/30 bg-red-500\/10'\s*:\s*'border-green-500\/30 bg-green-500\/10'\s*\)\}/m;

const classReplacement = `className={cn(
                                'flex items-center gap-3 p-3 rounded-lg border',
                                (!availability?.available || (pricing && pricing.total === 0 && pricing.appliedRule === 'Chưa thiết lập giá'))
                                    ? 'border-red-500/30 bg-red-500/10' 
                                    : 'border-green-500/30 bg-green-500/10'
                            )}`;

code = code.replace(classRegex, classReplacement);

fs.writeFileSync('apps/frontend/src/components/booking/NewBookingModal.tsx', code);
