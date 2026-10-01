const fs = require('fs');

function updateFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    const newChangeFunc = `    const handleOtpChange = (index: number, value: string) => {
        const cleanValue = value.replace(/\\D/g, '');
        if (!cleanValue && value) return;

        // If the user pastes or the keyboard auto-fills multiple characters
        if (cleanValue.length > 1) {
            const digits = cleanValue.split('').slice(0, 6 - index);
            setOtp(prev => {
                const newOtp = [...prev];
                digits.forEach((digit, i) => {
                    if (index + i < 6) newOtp[index + i] = digit;
                });
                return newOtp;
            });
            
            // Focus the next empty input or the last one
            const nextIndex = Math.min(index + digits.length, 5);
            const nextInput = document.getElementById(\`otp-\${nextIndex}\`);
            if (nextInput) {
                setTimeout(() => nextInput.focus(), 0);
            }
            return;
        }

        const char = cleanValue;
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

    // Regex to match the current handleOtpChange (between handleOtpChange and handleOtpPaste)
    const regex = /const handleOtpChange = \(index: number, value: string\) => \{[\s\S]*?\};\s*(?=const handleOtpPaste)/;
    
    if (regex.test(content)) {
        content = content.replace(regex, newChangeFunc + '\n\n    ');
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated ' + filePath);
    } else {
        console.log('Regex did not match ' + filePath);
    }
}

updateFile('apps/frontend/src/pages/RegisterPage.tsx');
updateFile('apps/frontend/src/pages/PortalForgotPasswordPage.tsx');
