import dotenv from 'dotenv';
import { resolve } from 'node:path';

const backendRoot = resolve(__dirname, '../..');
dotenv.config({
    path: [resolve(backendRoot, '.env'), resolve(backendRoot, '../../.env')],
});

const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';
const corsOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const developmentOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:2999',
    'http://127.0.0.1:2999',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
];
const allowedCorsOrigins = [...new Set([
    ...(isProduction ? [] : developmentOrigins),
    ...corsOrigins,
])];
const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
const databaseUrl = process.env.DATABASE_URL || '';

if (isProduction) {
    const missingSettings = [
        !databaseUrl && 'DATABASE_URL',
        jwtSecret.length < 32 && 'JWT_SECRET (tối thiểu 32 ký tự)',
        jwtRefreshSecret.length < 32 && 'JWT_REFRESH_SECRET (tối thiểu 32 ký tự)',
        jwtSecret === jwtRefreshSecret && 'JWT_REFRESH_SECRET phải khác JWT_SECRET',
        corsOrigins.length === 0 && 'CORS_ORIGIN (danh sách origin, phân tách bằng dấu phẩy)',
    ].filter(Boolean);
    if (missingSettings.length > 0) {
        throw new Error(`Thiếu hoặc cấu hình không an toàn cho production: ${missingSettings.join(', ')}`);
    }
}

for (const origin of corsOrigins) {
    let parsedOrigin: URL;
    try {
        parsedOrigin = new URL(origin);
    } catch {
        throw new Error(`CORS_ORIGIN chứa origin không hợp lệ: ${origin}`);
    }
    if (parsedOrigin.origin !== origin || origin === 'null' || origin === '*') {
        throw new Error(`CORS_ORIGIN phải chứa origin chính xác (scheme + host + port): ${origin}`);
    }
    if (isProduction && parsedOrigin.protocol !== 'https:') {
        throw new Error(`CORS_ORIGIN trong production phải dùng HTTPS: ${origin}`);
    }
}

export const config = {
    env,
    port: parseInt(process.env.PORT || '3000', 10),

    database: {
        url: databaseUrl,
    },

    jwt: {
        secret: jwtSecret,
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        refreshSecret: jwtRefreshSecret,
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },

    cors: {
        origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
            if (!origin || allowedCorsOrigins.includes(origin)) {
                callback(null, true);
                return;
            }
            callback(new Error(`Origin không được phép truy cập API: ${origin}`));
        },
    },

    pagination: {
        defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE || '20', 10),
        maxPageSize: parseInt(process.env.MAX_PAGE_SIZE || '100', 10),
    },
} as const;
