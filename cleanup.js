const fs = require('fs');

function cleanFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    const pasteRegex = /const handleOtpPaste = [\s\S]*?(?=const handleOtpKeyDown =)/;
    const keyDownRegex = /const handleOtpKeyDown = [\s\S]*?(?=const handleVerifyOtp =)/;
    
    content = content.replace(pasteRegex, '');
    content = content.replace(keyDownRegex, '');

    fs.writeFileSync(filePath, content, 'utf8');
}

cleanFile('apps/frontend/src/pages/RegisterPage.tsx');
cleanFile('apps/frontend/src/pages/PortalForgotPasswordPage.tsx');
console.log('Cleaned');
