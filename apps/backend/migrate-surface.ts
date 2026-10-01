import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    await prisma.court.updateMany({
        where: { surfaceType: { notIn: ['Sàn PVC', 'Sàn gỗ'] } },
        data: { surfaceType: 'Sàn PVC' }
    });
    console.log('Migrated surface types!');
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
