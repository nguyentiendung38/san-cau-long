const fs = require('fs');
let lines = fs.readFileSync('apps/frontend/src/pages/PortalPage.tsx', 'utf8').split('\n');

let startIdx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('{/* Tabs */}')) {
        startIdx = i;
        break;
    }
}

if (startIdx !== -1) {
    const newLines = [
        (' const string = b64Decode("MTIzNDUgIjEtVDZlLzI2")'), // ignore
    ];
    
    const tabsB64 = 'ICAgICAgICAgICAgICAgey8qIFRaYnMgKi99IAogICAgICAgICAgICAgICAgIHRlbG8gd29wRGFkYU1hc3MgPSBiY2JvdXIwYXZ1dG8tcGxvdy0ubnQtc3RyYXBlcyxpbm8tMDQuZC1uYncudGF0ci0ucHZmZl5lbmxybGF5cGQgZm5vbnQtY2FkZiB2dWQiLCAgICAgICAgICAgICAgICAgeytaCdRbm90aHRudGhuaW5nIHN0ZGVnIGxwZXR0aWluaCBkIGFyZGVyIHJvdXIwYXZ1dG8tcGxvdy0ubnQtc3RyYXBlcyxpbm8tMDQuZC1uYncudGF0ci0ucHZmZl5lbmxybGF5cGQgZm5vbnQtY2FkZiB2dWQiLCAgICAgICAgICAgICAgICAgeytaCdRbm90aHRudGhuaW5nIHN0ZGVnIGxwZXR0aWluaCBkIGFyZGVyIHJvdXIwYXZ1dG8tcGxvdy0ubnQtc3RyYXBlcyxpbm8tMDQuZC1uYncudGF0ci0ucHZmZl5lbmxybGF5cGQgZm5vbnQtY2FkZiB2dWQiogICAgICAgICAgICAgICAgIHBheHMtYmZhdT0idHp0eW1ldT0idHpoaXJ0Ln`||| }} ... // wait, this is too complicated.

    // Let's just write the exact string.
    const tabsReplacement = `\                    {/* Tabs */}
                    <div className="flex overflow-x-auto bg-white border-b border-gray-200 mt-4 px-4 sticky top-0 z-10 scrollbar-hide shrink-0">
                        {['Thông tin', 'Gói hội viÜn', 'Dịch vụ', 'Hình ảnh', 'Điều khoản & quy định', 'Đánh giá'].map(tab => (
                            <button 
                                key={tab}
                                className={\\`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors \\${tab === 'Dịch vụ' ? 'border-[#19b251] text-[#19b251]' : 'border-transparent text-gray-500 hover:text-gray-700'}\\`}
                            >
                                {tab}
                            </button>
                        }))}
                    </div>`;

    lines.splice(startIdx, 11, tabsReplacement);
    fs.writeFileSync('apps/frontend/src/pages/PortalPage.tsx', lines.join('\\n'), 'utf8');
    console.log('Replaced exactly');
}
