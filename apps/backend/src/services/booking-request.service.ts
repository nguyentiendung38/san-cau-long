import prisma from '../config/database.js';
import { AppError } from '../middleware/error.js';

export class BookingRequestService {
    async create(data: any) {
        const { BookingService } = await import('./booking.service.js');
        const bookingService = new BookingService();
        
        // Validation check for operating hours and pricing
        const court = await prisma.court.findUnique({
            where: { id: data.courtId },
            include: { venue: true }
        });
        if (!court) throw new AppError(404, 'Không tìm thấy sân');
        
        
        const dateObj = new Date(data.date);
        const dayNum = dateObj.getDay(); 
        const operatingHours = await prisma.operatingHour.findMany({
            where: { venueId: data.venueId, isActive: true }
        });
        
        if (operatingHours.length > 0) {
            let isOpen = false;
            let validStart = '';
            let validEnd = '';
            
            for (const oh of operatingHours) {
                if (oh.daysOfWeek && oh.daysOfWeek.includes(dayNum.toString())) {
                    isOpen = true;
                    validStart = oh.startTime;
                    validEnd = oh.endTime;
                    break;
                }
            }
            
            if (!isOpen) {
                throw new AppError(400, 'Cơ sở không hoạt động vào ngày bạn chọn.');
            }
            
            if (data.startTime < validStart || data.endTime > validEnd) {
                throw new AppError(400, `Cơ sở chỉ mở cửa từ ${validStart} đến ${validEnd} vào ngày này.`);
            }
        }
        
        const pricing = await bookingService.calculatePrice(data.courtId, new Date(data.date), data.startTime, data.endTime);
        if (pricing.total <= 0 || pricing.appliedRule?.startsWith('Chưa thiết lập giá')) {
            throw new AppError(400, 'Khung giờ này ngoài giờ hoạt động (chưa thiết lập giá)');
        }
        
        
        const dateObjStart = new Date(data.date);
        dateObjStart.setHours(0, 0, 0, 0);
        const dateObjEnd = new Date(data.date);
        dateObjEnd.setHours(23, 59, 59, 999);

        console.log('Checking overlap for:', data.courtId, dateObjStart, dateObjEnd, data.startTime, data.endTime);
        const existingBookings = await prisma.booking.findMany({
            where: {
                courtId: data.courtId,
                date: { gte: dateObjStart, lte: dateObjEnd },
                status: { notIn: ['CANCELLED', 'COMPLETED'] }
            }
        });

        const fifteenMinsAgo = new Date(Date.now() - 15 * 60000);
        const existingRequests = await prisma.bookingRequest.findMany({
            where: {
                courtId: data.courtId,
                date: { gte: dateObjStart, lte: dateObjEnd },
                status: 'PENDING',
                OR: [
                    { paymentMethod: { not: 'VNPAY' } },
                    { createdAt: { gte: fifteenMinsAgo } }
                ]
            }
        });

        console.log('Found existing bookings:', existingBookings.length, 'requests:', existingRequests.length);
        const isOverlap = (s1: string, e1: string, s2: string, e2: string) => {
            return s1 < e2 && s2 < e1;
        };

        for (const b of existingBookings) {
            if (isOverlap(data.startTime, data.endTime, b.startTime, b.endTime)) {
                throw new AppError(400, 'Khung giờ này đã có người đặt, vui lòng chọn giờ khác.');
            }
        }
        for (const r of existingRequests) {
            if (isOverlap(data.startTime, data.endTime, r.startTime, r.endTime)) {
                throw new AppError(400, 'Khung giờ này đang có người khác thực hiện đặt sân, vui lòng chọn giờ khác.');
            }
        }

        let paymentAmount = pricing.total;

        
        // C?ng thm ti?n d?ch v? (n?u c)
        if (data.orderedItems && Array.isArray(data.orderedItems)) {
            const itemsTotal = data.orderedItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
            paymentAmount += itemsTotal;
        }

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
                paymentAmount,
                paymentProof: data.paymentProof,
                orderedItems: parsedOrderedItems && parsedOrderedItems.length > 0 ? JSON.stringify(parsedOrderedItems) : null,
                voucherCode: data.voucherCode,
                discountAmount: data.discountAmount || 0,
            },
        });
    }

    async getAll(venueId?: string) {
        return prisma.bookingRequest.findMany({
            where: venueId ? { venueId } : {},
            orderBy: { createdAt: 'desc' },
            include: {
                venue: { select: { name: true } },
                court: { select: { name: true } },
            }
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

    async updatePaymentStatus(id: string, paymentStatus: string, paymentAmount?: number) {
        const dataToUpdate: any = { paymentStatus };
        if (paymentAmount !== undefined) {
            dataToUpdate.paymentAmount = paymentAmount;
        }
        return prisma.bookingRequest.update({
            where: { id },
            data: dataToUpdate,
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
                orderedItems: request.orderedItems,
                createdById: userId,
                paymentMethod: request.paymentMethod,
                paymentStatus: request.paymentStatus,
                paymentAmount: request.paymentStatus === 'PAID' ? request.paymentAmount : 0,
                paymentProof: request.paymentProof,
            });

            // 4. Nếu thanh toán MoMo → tạo Invoice PAID ngay lập tức
            if (request.paymentMethod === 'VNPAY') {
                try {
                    const mod = await import('./invoice.service.js');
                    const invoiceService = mod.invoiceService || (mod.default && mod.default.invoiceService);
                    
                    if (invoiceService) {
                        let productItems = [];
                        let serviceItems = [];
                        if (request.orderedItems) {
                            try {
                                const items = JSON.parse(request.orderedItems);
                                productItems = items.filter((i: any) => i.type === 'product').map((i: any) => ({ productId: i.id, quantity: i.quantity, unitPrice: i.price }));
                                serviceItems = items.filter((i: any) => i.type === 'service').map((i: any) => ({ serviceId: i.id, quantity: i.quantity, unitPrice: i.price }));
                            } catch (e) {
                                console.error('Parse orderedItems error', e);
                            }
                        }

                        await invoiceService.create({
                            customerId: customer.id,
                            bookingIds: [booking.id],
                            productItems,
                            serviceItems,
                            paymentMethod: 'VNPAY',
                            paymentStatus: 'PAID',
                            paidAmount: booking.totalAmount,
                            discount: request.discountAmount || 0,
                            discountType: 'FIXED',
                            notes: `Thanh toán trực tuyến VNPAY - Tự động${request.voucherCode ? ` (Voucher: ${request.voucherCode})` : ''}`,
                        });
                    } else {
                        console.error('[MoMo] Khong the resolve invoiceService');
                    }
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
