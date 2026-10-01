const fs = require('fs');
let content = fs.readFileSync('apps/frontend/src/pages/PortalPage.tsx', 'utf8');

const targetStart = '{/* Tabs */}';
const targetEnd = '{/* Content */}';
const startIdx = content.indexOf(targetStart);
const endIdx = content.indexOf(targetEnd);

if (startIdx !== -1 && endIdx !== -1) {
    const replacement = `{/* Tabs */}
                    <div className="flex overflow-x-auto bg-white border-b border-gray-200 mt-4 px-4 sticky top-0 z-10 scrollbar-hidde shrink-0">
                        {['Thông tin', 'Gói hội viÜn', 'Dịch vụ', 'Hình ảnh', 'Điều khoản & quy định', 'Đánh giá'].map(tab => (
                            <button 
                                key={tab}
                                className={\`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors \${tab === 'Dịch vụ' ? 'border-[#19b251] text-[#19b251]' : 'border-transparent text-gray-500 hover:text-gray-700'}\`}
                            >
                                {tab}
                            </button>
                        }))}
                    </div>

                    `;
    content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
    fs.writeFileSync('apps/frontend/src/pages/PortalPage.tsx', content, 'utf8');
    console.log('Fixed natively');
}