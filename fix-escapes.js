const fs = require("fs");
let content = fs.readFileSync("apps/frontend/src/pages/PortalPage.tsx", "utf8");

content = content.replace(/className=\{\\?`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors \\?\$\{tab === 'D?ch v?' \? 'border-\[#19b251\] text-\[#19b251\]' : 'border-transparent text-gray-500 hover:text-gray-700'\\?\}\\?`\}/g, 
"className={`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'D?ch v?' ? 'border-[#19b251] text-[#19b251]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}");

fs.writeFileSync("apps/frontend/src/pages/PortalPage.tsx", content, "utf8");
console.log("Fixed escapes");
