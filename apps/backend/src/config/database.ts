import { PrismaClient } from '@prisma/client';

declare global {
    var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Bật chế độ WAL và busy_timeout để chạy song song mượt mà với DB Browser for SQLite mà không bị khóa file (database is locked)
if (!global.prisma && process.env.DATABASE_URL && !process.env.VITEST && typeof prisma.$queryRawUnsafe === 'function') {
    prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;')
        .then(() => prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;'))
        .catch(() => {});
}

if (process.env.NODE_ENV !== 'production') {
    global.prisma = prisma;
}

export default prisma;
