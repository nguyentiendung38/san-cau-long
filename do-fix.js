const fs = require('fs');
let content = fs.readFileSync('apps/frontend/src/pages/PortalPage.tsx', 'utf8');

const replacementB64 = 'ICAgICAgICAgICAgICAgIG1pdiBjYmFzc25hbWU9ImZsZXgtMSI+CiAgICAgICAgICAgICAgICAgICHkaXYgY2xhc3NOYW1lPSJmb250LW1lZGl1bSB0ZXh0LWdyYXktODAwIj5UaG9nIGJáoPC9haXY+CiAgICAgICAgICAgICAgICAgICHkaXYgY2xhc3NOYW1lPSJ0ZXh0LWdyYXktNTAwIHRleHQtcy0tMXRtLTAuNSI>CiAgICAgICAgICAgICAgICAgICAgICAgIH0GZXZUb2FzdA5pc0FkZCApICdExJDQ0yB0aMAqQiBvYW8gZGFuaCBzwGFjaCB5w6pvIHRotGInIDogJ3EkxJTQ0iB4wwNhIGt4PoPhIGRhbmggc8OhY2ggecOqdSB0aDInPwogICAgICAgICAgICAgICAgICCpdiY6CiAgICAgICAgICAgICAgICAgPC9haXY+';
const replacement = Buffer.from(replacementB64, 'base64').toString('utf8');

const regex = /<div className="flex-1">[\\s\\S]*?<\/div>\\s*<\/div>/;
content = content.replace(regex, replacement);

fs.writeFileSync('apps/frontend/src/pages/PortalPage.tsx', content, 'utf8');
console.log('Done');