const fs = require('fs');

function applySingleInputOTP(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Find the start of handleOtpChange and delete up to handleVerifyOtp
    const changeRegex = /const handleOtpChange = [\s\S]*?(?=const handleVerifyOtp =)/;
    content = content.replace(changeRegex, '');

    // Now replace the OTP rendering HTML
    const htmlRegex = /<div className="flex gap-2 justify-center py-4">[\s\S]*?<\/div>/;
    const newHtml = `<div className="relative flex gap-2 justify-center py-4 w-[340px] mx-auto">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    autoComplete="one-time-code"
                                    value={otp.join('')}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\\D/g, '').slice(0, 6);
                                        setOtp(prev => {
                                            const newOtp = ['', '', '', '', '', ''];
                                            for(let i=0; i<val.length; i++) newOtp[i] = val[i];
                                            return newOtp;
                                        });
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10"
                                />
                                {otp.map((digit, index) => {
                                    const isActive = otp.join('').length === index || (index === 5 && otp.join('').length === 6);
                                    return (
                                        <div
                                            key={index}
                                            className={\`w-12 h-14 border-2 rounded-xl flex items-center justify-center text-2xl font-bold transition-all bg-white \${isActive ? 'border-green-500 ring-1 ring-green-500' : 'border-gray-300'} text-gray-800\`}
                                        >
                                            {digit}
                                        </div>
                                    );
                                })}
                            </div>`;

    if (content.match(htmlRegex)) {
        content = content.replace(htmlRegex, newHtml);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed ' + filePath);
    } else {
        console.log('HTML not matched in ' + filePath);
    }
}

applySingleInputOTP('apps/frontend/src/pages/RegisterPage.tsx');
applySingleInputOTP('apps/frontend/src/pages/PortalForgotPasswordPage.tsx');
