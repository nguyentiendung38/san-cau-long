const fs = require('fs');
let content = fs.readFileSync('apps/frontend/src/pages/PortalForgotPasswordPage.tsx', 'utf8');

const oldChangeFunc = `    const handleOtpChange = (index: number, value: string) => {
        const cleanValue = value.replace(/\\D/g, '');
        if (cleanValue === '' && value !== '') return;

        const lastChar = cleanValue.slice(-1);

        setOtp(prev => {
            const newOtp = [...prev];
            newOtp[index] = lastChar;
            return newOtp;
        });

        if (lastChar !== '' && index < 5) {
            setTimeout(() => {
                document.getElementById(\`otp-\${index + 1}\`)?.focus();
            }, 10);
        }
    };`;

const newChangeFunc = `    const handleOtpChange = (index: number, value: string) => {
        const cleanValue = value.replace(/\\D/g, '');
        if (!cleanValue && value) return;

        // Take only the first character that was added
        const char = cleanValue.charAt(cleanValue.length - 1);
        if (!char) {
            setOtp(prev => {
                const newOtp = [...prev];
                newOtp[index] = '';
                return newOtp;
            });
            return;
        }

        setOtp(prev => {
            const newOtp = [...prev];
            newOtp[index] = char;
            return newOtp;
        });

        // Focus next
        if (index < 5) {
            const nextInput = document.getElementById(\`otp-\${index + 1}\`);
            if (nextInput) {
                setTimeout(() => nextInput.focus(), 0);
            }
        }
    };`;

content = content.replace(oldChangeFunc, newChangeFunc);

const oldKeyDown = `    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
            document.getElementById(\`otp-\${index - 1}\`)?.focus();
        }
    };`;

const newKeyDown = `    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            const prevInput = document.getElementById(\`otp-\${index - 1}\`);
            if (prevInput) {
                prevInput.focus();
            }
        } else if (e.key === 'ArrowLeft' && index > 0) {
            document.getElementById(\`otp-\${index - 1}\`)?.focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
            document.getElementById(\`otp-\${index + 1}\`)?.focus();
        }
    };`;

content = content.replace(oldKeyDown, newKeyDown);

const oldInput = `                                        id={\`otp-\${index}\`}
                                        type="text"
                                        inputMode="numeric"
                                        value={digit}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => handleOtpChange(index, e.target.value)}
                                        onPaste={handleOtpPaste}
                                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                        className="w-12 h-14 border-2 border-gray-300 rounded-xl text-center text-2xl font-bold text-gray-800 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all"`;

const newInput = `                                        id={\`otp-\${index}\`}
                                        type="text"
                                        maxLength={2}
                                        inputMode="numeric"
                                        value={digit}
                                        onFocus={(e) => e.target.select()}
                                        onChange={(e) => handleOtpChange(index, e.target.value)}
                                        onPaste={handleOtpPaste}
                                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                        className="w-12 h-14 border-2 border-gray-300 rounded-xl text-center text-2xl font-bold text-gray-800 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all"`;

content = content.replace(oldInput, newInput);

fs.writeFileSync('apps/frontend/src/pages/PortalForgotPasswordPage.tsx', content, 'utf8');
console.log('Success forgot password');
