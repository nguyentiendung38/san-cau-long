const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/components/booking/NewBookingModal.tsx', 'utf8');

const regexStartTime = /<select[\s\S]*?value=\{formData\.startTime\}[\s\S]*?<\/select>/m;
const replacementStartTime = `<input
                                type="time"
                                value={formData.startTime}
                                onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                                className={cn(
                                    "w-full bg-background-tertiary border rounded-lg px-3 py-2 text-foreground",
                                    "focus:outline-none focus:ring-2 focus:ring-primary-500",
                                    errors.startTime ? 'border-red-500' : 'border-border'
                                )}
                            />`;
                            
const regexEndTime = /<select[\s\S]*?value=\{formData\.endTime\}[\s\S]*?<\/select>/m;
const replacementEndTime = `<input
                                type="time"
                                value={formData.endTime}
                                onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                                className={cn(
                                    "w-full bg-background-tertiary border rounded-lg px-3 py-2 text-foreground",
                                    "focus:outline-none focus:ring-2 focus:ring-primary-500",
                                    errors.endTime ? 'border-red-500' : 'border-border'
                                )}
                            />`;

code = code.replace(regexStartTime, replacementStartTime);
code = code.replace(regexEndTime, replacementEndTime);
fs.writeFileSync('apps/frontend/src/components/booking/NewBookingModal.tsx', code);
