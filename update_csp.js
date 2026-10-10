const fs = require('fs');
let code = fs.readFileSync('apps/backend/src/routes/vnpay.routes.ts', 'utf8');

const cspCode = `res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-hashes'; style-src 'self' 'unsafe-inline';");`;

code = code.replace(/return res\.send\(successHtml\);/, `${cspCode}\n            return res.send(successHtml);`);
code = code.replace(/return res\.send\(failedHtml\);/, `${cspCode}\n            return res.send(failedHtml);`);

// Since 'unsafe-hashes' is sometimes not supported for attributes in older browsers, 
// let's ALSO change onclick="window.close()" to use an event listener inside the script tag!
const newSuccessHtml = code.match(/const successHtml = `([\s\S]*?)`;/)[1]
    .replace(/<button class="btn" onclick="window\.close\(\)">/, '<button class="btn" id="closeBtn">')
    .replace(/<script>[\s\S]*?<\/script>/, `<script>
        setTimeout(() => { window.close(); }, 3000);
        document.getElementById('closeBtn').addEventListener('click', () => { window.close(); });
    </script>`);

const newFailedHtml = code.match(/const failedHtml = `([\s\S]*?)`;/)[1]
    .replace(/<button class="btn" onclick="window\.close\(\)">/, '<button class="btn" id="closeBtn">')
    .replace(/<\/body>/, `<script>
        document.getElementById('closeBtn').addEventListener('click', () => { window.close(); });
    </script>\n</body>`);

code = code.replace(/const successHtml = `[\s\S]*?`;/, `const successHtml = \`${newSuccessHtml}\`;`);
code = code.replace(/const failedHtml = `[\s\S]*?`;/, `const failedHtml = \`${newFailedHtml}\`;`);

fs.writeFileSync('apps/backend/src/routes/vnpay.routes.ts', code);
