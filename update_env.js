const fs = require('fs');
let env = fs.readFileSync('apps/backend/.env', 'utf8');

// clean up the messy part
env = env.replace(/\0/g, ''); // remove null bytes
env = env.replace(/ V N P A Y _ R E T U R N _ U R L = " h t t p : \/ \/ 1 2 7 \. 0 \. 0 \. 1 : 3 0 0 5 \/ a p i \/ v n p a y \/ c a l l b a c k "/, '');
env = env.replace(/VNPAY_RETURN_URL.*$/gm, '');

// Append cleanly
env += '\nVNPAY_RETURN_URL="http://127.0.0.1:3005/api/vnpay/callback"\n';

fs.writeFileSync('apps/backend/.env', env.trim() + '\n');
