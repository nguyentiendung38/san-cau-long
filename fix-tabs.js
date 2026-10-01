const fs = require("fs");
let content = fs.readFileSync("apps/frontend/src/pages/PortalPage.tsx", "utf8");

const targetStart = "{/* Tabs */}";
const targetEnd = "{/* Content */}";
const startIdx = content.indexOf(targetStart);
const endIdx = content.indexOf(targetEnd);

if (startIdx !== -1 && endIdx !== -1) {
    const replacement = `{/* Tabs */}
                    <div className="flex overflow-x-auto bg-white border-b border-gray-200 mt-4 px-4 sticky top-0 z-10 scrollbar-hide shrink-0">
                        {['Thông tin', 'Gói h?i viên', 'D?ch v?', 'H?nh ?nh', 'Ði?u kho?n & quy ð?nh', 'Ðánh giá'].map(tab => (
                            <button 
                                key={tab}
                                className={\`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors \${tab === 'D?ch v?' ? 'border-[#19b251] text-[#19b251]' : 'border-transparent text-gray-500 hover:text-gray-700'}\`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    `;
    content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
    
    // Let's also fix the B?NG GIÁ SÂN table, just in case
    content = content.replace(/<h3 className=\"font-bold text-gray-800 text-\[15px\] uppercase mb-4 text-\[#19b251\]\">.*?<\/h3>/, '<h3 className=\"font-bold text-gray-800 text-[15px] uppercase mb-4 text-[#19b251]\">B?NG GIÁ SÂN</h3>');
    content = content.replace(/<div className=\"bg-white px-4 py-3 border-b border-gray-200 font-bold text-sm text-gray-800 text-center\">\s*.*?\s*<\/div>/, '<div className=\"bg-white px-4 py-3 border-b border-gray-200 font-bold text-sm text-gray-800 text-center\">\n                                Sân C?u Lông\n                            </div>');
    
    // Also fix the tag "C?u lông"
    content = content.replace(/<MapPin className=\"w-3 h-3\" \/> .*?<\/div>/g, '<MapPin className=\"w-3 h-3\" /> C?u lông</div>');
    content = content.replace(/<span className=\"text-\[#19b251\] font-medium cursor-pointer\">.*?<\/span>/g, '<span className=\"text-[#19b251] font-medium cursor-pointer\">Liên h?</span>');

    // And inside the table headers
    content = content.replace(/<th className=\"py-3 px-2 border-r border-gray-200 font-bold\">Th\?<\/th>/, '<th className=\"py-3 px-2 border-r border-gray-200 font-bold\">Th?</th>');
    content = content.replace(/<th className=\"py-3 px-2 border-r border-gray-200 font-bold\">Khung gi\?<\/th>/, '<th className=\"py-3 px-2 border-r border-gray-200 font-bold\">Khung gi?</th>');
    content = content.replace(/<th className=\"py-3 px-2 border-r border-gray-200 font-bold\">C\? .\?nh<\/th>/, '<th className=\"py-3 px-2 border-r border-gray-200 font-bold\">C? ð?nh</th>');
    content = content.replace(/<th className=\"py-3 px-2 font-bold\">V\?ng lai<\/th>/, '<th className=\"py-3 px-2 font-bold\">V?ng lai</th>');
    content = content.replace(/Th\?/, 'Th?');
    content = content.replace(/Khung gi\?/, 'Khung gi?');
    content = content.replace(/C\? \??nh/, 'C? ð?nh');
    content = content.replace(/V\?ng lai/, 'V?ng lai');

    fs.writeFileSync("apps/frontend/src/pages/PortalPage.tsx", content, "utf8");
    console.log("Fixed tabs and tables encoding");
} else {
    console.log("Target not found");
}
