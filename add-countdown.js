const fs = require('fs');

function addCountdownToRegister() {
    const filePath = 'apps/frontend/src/pages/RegisterPage.tsx';
    let content = fs.readFileSync(filePath, 'utf8');

    // Add state variables
    if (!content.includes('countdown')) {
        const stateInject = `
    const [countdown, setCountdown] = useState(60);
    const [canResend, setCanResend] = useState(false);

    React.useEffect(() => {
        let timer: NodeJS.Timeout;
        if (step === 2 && countdown > 0) {
            timer = setInterval(() => setCountdown(c => c - 1), 1000);
        } else if (countdown === 0) {
            setCanResend(true);
        }
        return () => clearInterval(timer);
    }, [step, countdown]);
`;
        content = content.replace('const [otp, setOtp] = useState([\'\', \'\', \'\', \'\', \'\', \'\']);', 'const [otp, setOtp] = useState([\'\', \'\', \'\', \'\', \'\', \'\']);' + stateInject);
    }

    // Update handleRequestOtp to reset countdown
    if (!content.includes('setCountdown(60)')) {
        content = content.replace('setStep(2);', 'setStep(2);\n            setCountdown(60);\n            setCanResend(false);');
    }

    // Update the button HTML
    const buttonHtmlRegex = /<button\s+type="button"\s+onClick=\{handleRequestOtp\}\s+disabled=\{isLoading\}\s+className="text-sm font-semibold text-green-700 hover:text-green-800"\s*>\s*G?i l?i m? OTP\s*<\/button>/;
    
    const newButton = `<button 
                                type="button" 
                                onClick={handleRequestOtp} 
                                disabled={isLoading || !canResend}
                                className={\`text-sm font-semibold transition-colors \${canResend ? 'text-green-700 hover:text-green-800' : 'text-gray-400 cursor-not-allowed'}\`}
                            >
                                {canResend ? 'G?i l?i m? OTP' : \`G?i l?i m? sau (\${countdown}s)\`}
                            </button>`;
                            
    content = content.replace(buttonHtmlRegex, newButton);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Added countdown to RegisterPage');
}

function addCountdownToForgot() {
    const filePath = 'apps/frontend/src/pages/PortalForgotPasswordPage.tsx';
    let content = fs.readFileSync(filePath, 'utf8');

    // Add state variables
    if (!content.includes('countdown')) {
        const stateInject = `
    const [countdown, setCountdown] = useState(60);
    const [canResend, setCanResend] = useState(false);

    React.useEffect(() => {
        let timer: NodeJS.Timeout;
        if (step === 2 && countdown > 0) {
            timer = setInterval(() => setCountdown(c => c - 1), 1000);
        } else if (countdown === 0) {
            setCanResend(true);
        }
        return () => clearInterval(timer);
    }, [step, countdown]);
`;
        content = content.replace('const [otp, setOtp] = useState([\'\', \'\', \'\', \'\', \'\', \'\']);', 'const [otp, setOtp] = useState([\'\', \'\', \'\', \'\', \'\', \'\']);' + stateInject);
    }

    // Update handleRequestOtp to reset countdown
    if (!content.includes('setCountdown(60)')) {
        content = content.replace('setStep(2);', 'setStep(2);\n            setCountdown(60);\n            setCanResend(false);');
    }

    // Update the button HTML
    const buttonHtmlRegex = /<button\s+type="button"\s+onClick=\{handleRequestOtp\}\s+disabled=\{isLoading\}\s+className="text-sm font-semibold text-green-700 hover:text-green-800"\s*>\s*G?i l?i m? OTP\s*<\/button>/;
    
    const newButton = `<button 
                                type="button" 
                                onClick={handleRequestOtp} 
                                disabled={isLoading || !canResend}
                                className={\`text-sm font-semibold transition-colors \${canResend ? 'text-green-700 hover:text-green-800' : 'text-gray-400 cursor-not-allowed'}\`}
                            >
                                {canResend ? 'G?i l?i m? OTP' : \`G?i l?i m? sau (\${countdown}s)\`}
                            </button>`;
                            
    content = content.replace(buttonHtmlRegex, newButton);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Added countdown to ForgotPasswordPage');
}

addCountdownToRegister();
addCountdownToForgot();
