const fs = require('fs');

// 1. Update .env
let env = fs.readFileSync('apps/backend/.env', 'utf8');
env = env.replace(/CORS_ORIGIN=.*/g, 'CORS_ORIGIN="http://localhost:5173,http://localhost:3000,http://192.168.1.23:3000"');
fs.writeFileSync('apps/backend/.env', env);

// 2. Update config/index.ts
let config = fs.readFileSync('apps/backend/src/config/index.ts', 'utf8');
config = config.replace(/origin: process\.env\.CORS_ORIGIN \|\| 'http:\/\/localhost:5173',/g, "origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),");
fs.writeFileSync('apps/backend/src/config/index.ts', config);
