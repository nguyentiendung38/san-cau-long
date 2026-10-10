const fs = require('fs');
let code = fs.readFileSync('apps/frontend/src/pages/PortalBookingVisual.tsx', 'utf8');

const oldStr = `                                            {visibleSlots.map(time => {
                                            const status = getSlotStatus(time);
                                            const isSelected = selectedSlots.includes(time);`;

const newStr = `                                            {visibleSlots.map(time => {
                                            const status = getSlotStatus(time);
                                            const isSelected = selectedSlots.includes(time);
                                            const dateStr = format(selectedDate, 'yyyy-MM-dd');
                                            const now = new Date();
                                            const nowStr = format(now, 'yyyy-MM-dd');
                                            const nowTime = format(now, 'HH:mm');`;

code = code.replace(oldStr, newStr);

fs.writeFileSync('apps/frontend/src/pages/PortalBookingVisual.tsx', code);
console.log('Fixed ReferenceError for real');
