import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Wiping database and creating root admin...');

    // Wipe everything
    const tablenames = await prisma.$queryRaw<Array<{ name: string }>>`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_migrations';`;

    for (const { name } of tablenames) {
        try {
            await prisma.$executeRawUnsafe(`DELETE FROM "${name}";`);
        } catch (error) {
            console.log(error);
        }
    }

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 12);
    const admin = await prisma.user.create({
        data: {
            email: 'admin@courtify.vn',
            passwordHash: adminPassword,
            name: 'Quản trị viên',
            phone: '0987654321',
            role: 'ADMIN',
        },
    });

    console.log('✅ Wiped database successfully.');
    console.log('✅ Created default admin: admin@courtify.vn / admin123');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
