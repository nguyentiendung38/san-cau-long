import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const reqs = await prisma.bookingRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3
    });
    console.log(JSON.stringify(reqs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
