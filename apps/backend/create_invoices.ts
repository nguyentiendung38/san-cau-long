import { PrismaClient } from '@prisma/client';
import { invoiceService } from './src/services/invoice.service.js';
const prisma = new PrismaClient();
(async () => {
    try {
        const reqs = await prisma.bookingRequest.findMany({ where: { paymentStatus: 'PAID' } });
        for (const req of reqs) {
            const booking = await prisma.booking.findFirst({ where: { courtId: req.courtId, date: req.date, startTime: req.startTime } });
            if (booking) {
                const existing = await prisma.invoiceItem.findFirst({ where: { bookingId: booking.id } });
                if (!existing) {
                    await invoiceService.create({
                        customerId: booking.customerId,
                        paymentMethod: 'VNPAY',
                        paymentStatus: 'PAID',
                        paidAmount: booking.paymentAmount,
                        depositAmount: 0,
                        bookingIds: [booking.id], // CORRECT PARAMETER!
                        notes: 'Online VNPAY payment',
                        productItems: [],
                        serviceItems: []
                    });
                    console.log('Created invoice for', booking.id);
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
})();
