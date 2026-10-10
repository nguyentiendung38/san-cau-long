const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/availability.tsx', 'utf8');

const oldStr = `                      if (booked) {
                        bgColor = "#FEF2F2";
                        textColor = "#DC2626";
                        borderColor = "#FCA5A5";
                      } else if (passed) {
                        bgColor = "#F3F4F6";
                        textColor = "#9CA3AF";
                        borderColor = "#E5E7EB";
                      }`;

const newStr = `                      if (passed) {
                        bgColor = "#F3F4F6";
                        textColor = "#9CA3AF";
                        borderColor = "#E5E7EB";
                      } else if (booked) {
                        bgColor = "#FEF2F2";
                        textColor = "#DC2626";
                        borderColor = "#FCA5A5";
                      }`;

code = code.replace(oldStr, newStr);

// Also remove the X mark if passed!
// In JSX: {booked && <Icon icon="zi-close" ...
const oldIconStr = `{booked && <Icon icon="zi-close" style={{ color: "#DC2626", fontSize: "14px", fontWeight: "bold" }} />}`;
const newIconStr = `{(booked && !passed) && <Icon icon="zi-close" style={{ color: "#DC2626", fontSize: "14px", fontWeight: "bold" }} />}`;

code = code.replace(oldIconStr, newIconStr);

fs.writeFileSync('apps/zalo-app/src/pages/availability.tsx', code);
console.log('Fixed Zalo past slots');
