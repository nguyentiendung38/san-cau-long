const fs = require("fs");
let content = fs.readFileSync("apps/frontend/src/pages/PortalPage.tsx", "utf8");

content = content.replace(
    /<button className="flex items-center gap-1\.5 hover:text-\[#19b251\] transition-colors whitespace-nowrap">\s*<CalendarCheck className="w-4 h-4" \/>\s*<span>Sân ð? ð?t<\/span>\s*<\/button>/,
    `<button onClick={() => setFilterMode(prev => prev === 'booked' ? 'all' : 'booked')} className={\`flex items-center gap-1.5 transition-colors whitespace-nowrap \${filterMode === 'booked' ? 'text-[#19b251] font-medium' : 'hover:text-[#19b251] text-gray-700'}\`}>
                                <CalendarCheck className="w-4 h-4" />
                                <span>Sân ð? ð?t</span>
                            </button>`
);

content = content.replace(
    /<button className="flex items-center gap-1\.5 hover:text-\[#19b251\] transition-colors whitespace-nowrap">\s*<Heart className="w-4 h-4" \/>\s*<span>Yêu thích<\/span>\s*<\/button>/,
    `<button onClick={() => setFilterMode(prev => prev === 'favorite' ? 'all' : 'favorite')} className={\`flex items-center gap-1.5 transition-colors whitespace-nowrap \${filterMode === 'favorite' ? 'text-[#ea580c] font-medium' : 'hover:text-[#19b251] text-gray-700'}\`}>
                                <Heart className={\`w-4 h-4 \${filterMode === 'favorite' ? 'fill-[#ea580c]' : ''}\`} />
                                <span>Yêu thích</span>
                            </button>`
);

fs.writeFileSync("apps/frontend/src/pages/PortalPage.tsx", content, "utf8");
console.log("Buttons updated");
