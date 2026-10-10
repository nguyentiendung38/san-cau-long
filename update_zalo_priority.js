const fs = require('fs');
let code = fs.readFileSync('apps/zalo-app/src/pages/availability.tsx', 'utf8');

const oldLogic = "                      if (passed) {\\n" +
"                        bgColor = \\"#F3F4F6\\";\\n" +
"                        textColor = \\"#9CA3AF\\";\\n" +
"                        borderColor = \\"#E5E7EB\\";\\n" +
"                      } else if (booked) {\\n" +
"                        bgColor = \\"#FEF2F2\\";\\n" +
"                        textColor = \\"#DC2626\\";\\n" +
"                        borderColor = \\"#FCA5A5\\";\\n" +
"                      }";

const newLogic = "                      if (booked) {\\n" +
"                        bgColor = \\"#FEF2F2\\";\\n" +
"                        textColor = \\"#DC2626\\";\\n" +
"                        borderColor = \\"#FCA5A5\\";\\n" +
"                      } else if (passed) {\\n" +
"                        bgColor = \\"#F3F4F6\\";\\n" +
"                        textColor = \\"#9CA3AF\\";\\n" +
"                        borderColor = \\"#E5E7EB\\";\\n" +
"                      }";

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('apps/zalo-app/src/pages/availability.tsx', code);
