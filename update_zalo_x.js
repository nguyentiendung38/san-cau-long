const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/availability.tsx', 'utf8');

const oldCode = `<span style={{ fontSize: "11px", fontWeight: "bold" }}>{time}-{nextTime}</span>
                        </div>`;

const newCode = `<div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {booked && <Icon icon="zi-close" style={{ color: "#DC2626", fontSize: "14px", fontWeight: "bold" }} />}
                            <span style={{ fontSize: "11px", fontWeight: "bold" }}>{time}-{nextTime}</span>
                          </div>
                        </div>`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('apps/zalo-app/src/pages/availability.tsx', code);
