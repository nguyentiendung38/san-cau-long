const fs = require('fs');
let lines = fs.readFileSync('apps/frontend/src/pages/PortalPage.tsx', 'utf8').split('\n');

const startIdx = lines.findIndex(l => l.includes('{/* Tabs */}'));
if (startIdx !== -1) {
    const tabsReplacement = [
        '                    {/* Tabs */}',
        '                    <div className="flex overflow-x-auto bg-white border-b border-gray-200 mt-4 px-4 sticky top-0 z-10 scrollbar-hide shrink-0">',
        '                        <button className="whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors border-transparent text-gray-500 hover:text-gray-700">Thông tin</button>',
        '                        <button className="whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors border-transparent text-gray-500 hover:text-gray-700">Gói hội viên</button>',
        '                        <button className="whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors border-[#19b251] text-[#19b251]">Dịch vụ</button>',
        '                        <button className="whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors border-transparent text-gray-500 hover:text-gray-700">Hình ảnh</button>',
        '                        <button className="whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors border-transparent text-gray-500 hover:text-gray-700">Điều khoản & quy định</button>',
        '                        <button className="whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors border-transparent text-gray-500 hover:text-gray-700">Đánh giá</button>',
        '                    </div>'
    ];
    
    const replacement = Buffer.from(tabsReplacement.join('\n'), 'utf8').toString('utf8');
    lines.splice(startIdx, 11, replacement);
    fs.writeFileSync('apps/frontend/src/pages/PortalPage.tsx', lines.join('\\n'), 'utf8');
    console.log('Replaced tabs with hardcoded buttons');
}