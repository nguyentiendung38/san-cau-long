const fs = require('fs');
let env = fs.readFileSync('apps/backend/.env', 'utf8');
env = env.replace(/CORS_ORIGIN=.*/g, 'CORS_ORIGIN="*"');
fs.writeFileSync('apps/backend/.env', env);
