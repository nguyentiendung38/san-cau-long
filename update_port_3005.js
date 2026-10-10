const fs = require('fs');
let code = fs.readFileSync('apps/frontend/vite.config.ts', 'utf8');
code = code.replace(/target: 'http:\/\/localhost:3000'/g, "target: 'http://localhost:3005'");
fs.writeFileSync('apps/frontend/vite.config.ts', code);

// Also replace in frontend/src
function replaceInFile(path) {
    if(fs.existsSync(path)) {
        let content = fs.readFileSync(path, 'utf8');
        content = content.replace(/3000/g, '3005');
        fs.writeFileSync(path, content);
    }
}
replaceInFile('apps/frontend/src/hooks/useWebSocket.tsx');
replaceInFile('apps/frontend/src/pages/PortalBookingFloatingForm.tsx');
replaceInFile('apps/frontend/src/pages/PortalPage.tsx');
replaceInFile('apps/frontend/src/services/export.service.ts');
