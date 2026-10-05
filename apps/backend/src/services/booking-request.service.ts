import prisma from '../config/database.js';
import { AppError } from '../middleware/error.js';

export class BookingRequestService {
    async create(data: any) {
        return prisma.bookingRequest.create({
            data: {
                venueId: data.venueId,
                courtId: data.courtId,
                name: data.name,
                phone: data.phone,
                date: new Date(data.date),
                startTime: data.startTime,
                endTime: data.endTime,
                notes: data.notes,
                status: 'PENDING',
                paymentMethod: data.paymentMethod || 'DEPOSIT_TRANSFER',
                paymentAmount: Number(data.paymentAmount || 0),
                paymentProof: data.paymentProof,
            },
        });
    }

    async getAll(venueId?: string) {
        return prisma.bookingRequest.findMany({
            where: venueId ? { venueId } : {},
            orderBy: { createdAt: 'desc' },
        });
    }

    async getByPhone(phone: string) {
        return prisma.bookingRequest.findMany({
            where: { phone },
            orderBy: { createdAt: 'desc' },
            include: {
                venue: { select: { name: true, address: true, logo: true } },
                court: { select: { name: true } },
            }
        });
    }

    async updatePaymentStatus(id: string, paymentStatus: string) {
        return prisma.bookingRequest.update({
            where: { id },
            data: { paymentStatus },
        });
    }

    async updateStatus(id: string, status: string, userId?: string) {
        if (status === 'APPROVED') {
            const request = await prisma.bookingRequest.findUnique({ where: { id } });
            if (!request) throw new AppError(404, 'Không tìm thấy yêu cầu');
            if (request.status === 'APPROVED') return request;

            // 1. Find or create Customer
            let customer = await prisma.customer.findUnique({ where: { phone: request.phone } });
            if (!customer) {
                customer = await prisma.customer.create({
                    data: {
                        name: request.name,
                        phone: request.phone,
                    }
                });
            }

            // 2. Import BookingService dynamically to prevent circular dependencies
            const { bookingService } = await import('./booking.service.js');

            // 3. Auto create booking
            const booking = await bookingService.create({
                courtId: request.courtId!,
                customerId: customer.id,
                date: request.date,
                startTime: request.startTime,
                endTime: request.endTime,
                notes: `[Online] ${request.notes || ''}`,
                createdById: userId,
            });

            // 4. Nếu thanh toán MoMo → tạo Invoice PAID ngay lập tức
            if (request.paymentMethod === 'MOMO') {
                try {
                    const { invoiceService } = await import('./invoice.service.js');
                    await invoiceService.create({
                        customerId: customer.id,
                        bookingIds: [booking.id],
                        paymentMethod: 'MOMO',
                        paymentStatus: 'PAID',
                        paidAmount: booking.totalAmount,
                        notes: 'Thanh toán trực tuyến MoMo - Tự động',
                    });
                } catch (invoiceErr) {
                    console.error('[MoMo] Lỗi tạo invoice tự động:', invoiceErr);
                }
            }
        }

        return prisma.bookingRequest.update({
            where: { id },
            data: { status },
        });
    }

    async delete(id: string) {
        return prisma.bookingRequest.delete({
            where: { id },
        });
    }
}

export const bookingRequestService = new BookingRequestService();
