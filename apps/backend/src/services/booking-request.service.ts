import prisma from '../config/database.js';
import { AppError } from '../middleware/error.js';
import { voucherService } from './voucher.service.js';
import { isWithinOperatingHours, timeToMinutes } from '../utils/booking-rules.js';
import { parseBookingOrder } from '../utils/booking-order.js';
import { invoiceService } from './invoice.service.js';

interface RequestedOrderItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    type: 'product' | 'service';
}

export class BookingRequestService {
    async create(data: any) {
        const { BookingService } = await import('./booking.service.js');
        const bookingService = new BookingService();
        
        // Validation check for operating hours and pricing
        const court = await prisma.court.findUnique({
            where: { id: data.courtId },
            include: { venue: true }
        });
        if (!court || court.status !== 'ACTIVE') throw new AppError(404, 'Không tìm thấy sân đang nhận đặt');
        if (!court.venue.isActive) throw new AppError(400, 'Cơ sở hiện không nhận đặt sân');
        if (court.venueId !== data.venueId) throw new AppError(400, 'Sân không thuộc cơ sở đã chọn');
        
        
        const dateObj = new Date(data.date);
        const startMinutes = timeToMinutes(data.startTime);
        const endMinutes = timeToMinutes(data.endTime);
        if (
            Number.isNaN(dateObj.getTime()) ||
            startMinutes === null ||
            endMinutes === null ||
            startMinutes >= endMinutes ||
            startMinutes % 30 !== 0 ||
            endMinutes % 30 !== 0
        ) {
            throw new AppError(400, 'Ngày hoặc khung giờ đặt sân không hợp lệ');
        }
        const now = new Date();
        const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
        const requestDay = Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate());
        const lastBookableMonth = new Date(now.getFullYear(), now.getMonth() + 2, 1);
        if (requestDay < today) throw new AppError(400, 'Không thể đặt sân vào ngày đã qua');
        if (
            dateObj.getUTCFullYear() > lastBookableMonth.getFullYear() ||
            (dateObj.getUTCFullYear() === lastBookableMonth.getFullYear() &&
                dateObj.getUTCMonth() > lastBookableMonth.getMonth())
        ) {
            throw new AppError(400, 'Chỉ có thể đặt sân trong vòng hai tháng tới');
        }
        if (
            requestDay === today &&
            startMinutes < now.getHours() * 60 + now.getMinutes()
        ) {
            throw new AppError(400, 'Không thể đặt khung giờ đã bắt đầu');
        }
        const dayNum = dateObj.getUTCDay();
        const operatingHours = await prisma.operatingHour.findMany({
            where: { venueId: data.venueId, isActive: true }
        });
        if (!isWithinOperatingHours(operatingHours, dayNum, data.startTime, data.endTime)) {
            throw new AppError(400, 'Cơ sở không hoạt động trong khung giờ bạn chọn.');
        }
        
        const pricing = await bookingService.calculatePrice(data.courtId, new Date(data.date), data.startTime, data.endTime);
        if (pricing.total <= 0 || pricing.appliedRule?.startsWith('Chưa thiết lập giá')) {
            throw new AppError(400, 'Khung giờ này ngoài giờ hoạt động (chưa thiết lập giá)');
        }
        
        
        const dateObjStart = new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate()));
        const dateObjEnd = new Date(dateObjStart.getTime() + 24 * 60 * 60 * 1000 - 1);

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
                paymentStatus: { not: 'FAILED' },
                OR: [
                    { paymentMethod: { not: 'VNPAY' } },
                    { createdAt: { gte: fifteenMinsAgo } }
                ]
            }
        });

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

        let parsedOrderedItems = data.orderedItems;
        if (typeof data.orderedItems === 'string') {
            try {
                parsedOrderedItems = JSON.parse(data.orderedItems);
            } catch {
                throw new AppError(400, 'Danh sách sản phẩm/dịch vụ không hợp lệ');
            }
        }

        if (parsedOrderedItems !== undefined && !Array.isArray(parsedOrderedItems)) {
            throw new AppError(400, 'Danh sách sản phẩm/dịch vụ không hợp lệ');
        }
        const requestedItems = (parsedOrderedItems || []) as RequestedOrderItem[];
        const canonicalItems: RequestedOrderItem[] = [];
        for (const item of requestedItems) {
            if (
                !item ||
                typeof item.id !== 'string' ||
                !Number.isInteger(item.quantity) ||
                item.quantity < 1 ||
                !['product', 'service'].includes(item.type)
            ) {
                throw new AppError(400, 'Sản phẩm hoặc dịch vụ trong đơn không hợp lệ');
            }

            if (item.type === 'product') {
                const product = await prisma.product.findUnique({ where: { id: item.id } });
                if (!product || product.venueId !== court.venueId || !product.isActive) {
                    throw new AppError(400, 'Sản phẩm không còn khả dụng tại cơ sở này');
                }
                if (product.stock < item.quantity) {
                    throw new AppError(409, `Sản phẩm "${product.name}" không đủ tồn kho`);
                }
                canonicalItems.push({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    quantity: item.quantity,
                    type: 'product',
                });
            } else {
                const service = await prisma.service.findUnique({ where: { id: item.id } });
                if (!service || service.venueId !== court.venueId || !service.isActive) {
                    throw new AppError(400, 'Dịch vụ không còn khả dụng tại cơ sở này');
                }
                canonicalItems.push({
                    id: service.id,
                    name: service.name,
                    price: service.price,
                    quantity: item.quantity,
                    type: 'service',
                });
            }
        }

        const mergedItems = new Map<string, RequestedOrderItem>();
        for (const item of canonicalItems) {
            const key = `${item.type}:${item.id}`;
            const existing = mergedItems.get(key);
            if (existing) existing.quantity += item.quantity;
            else mergedItems.set(key, { ...item });
        }
        const orderItems = [...mergedItems.values()];
        for (const item of orderItems) {
            if (item.type === 'product') {
                const product = await prisma.product.findUnique({ where: { id: item.id } });
                if (!product || product.stock < item.quantity) {
                    throw new AppError(409, `Sản phẩm "${item.name}" không đủ tồn kho`);
                }
            }
        }

        const itemsTotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const subtotal = pricing.total + itemsTotal;
        let paymentAmount = subtotal;

        let discountAmount = 0;
        let voucherCode: string | undefined;
        if (data.voucherCode) {
            const voucherResult = await voucherService.validate(data.voucherCode, subtotal);
            discountAmount = voucherResult.discountAmount;
            paymentAmount = Math.max(0, paymentAmount - discountAmount);
            voucherCode = voucherResult.voucher.code;
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
                orderedItems: JSON.stringify({
                    items: orderItems,
                    subtotal,
                    totalAmount: paymentAmount,
                    discountAmount,
                    voucherCode,
                }),
                voucherCode,
                discountAmount,
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
        if (!['PENDING', 'PAID', 'FAILED'].includes(paymentStatus)) {
            throw new AppError(400, 'Trạng thái thanh toán không hợp lệ');
        }
        return prisma.$transaction(async (tx) => {
            const existing = await tx.bookingRequest.findUnique({ where: { id } });
            if (!existing) throw new AppError(404, 'Không tìm thấy yêu cầu đặt sân');
            const amount = paymentAmount ?? existing.paymentAmount;
            if (!Number.isFinite(amount) || amount < 0) {
                throw new AppError(400, 'Số tiền thanh toán không hợp lệ');
            }
            const requestOrder = parseBookingOrder(existing.orderedItems);
            const requestedTotal = requestOrder.totalAmount ?? existing.paymentAmount;
            if (amount > requestedTotal) {
                throw new AppError(400, 'Số tiền đã nhận không được vượt tổng tiền đặt sân');
            }

            const request = await tx.bookingRequest.update({
                where: { id },
                data: {
                    paymentStatus,
                    ...(paymentAmount !== undefined ? { paymentAmount } : {}),
                    ...(requestOrder.totalAmount === undefined
                        ? {
                            orderedItems: JSON.stringify({
                                items: requestOrder.items,
                                discountAmount: existing.discountAmount || requestOrder.discountAmount,
                                voucherCode: requestOrder.voucherCode || existing.voucherCode || undefined,
                                totalAmount: requestedTotal,
                            }),
                        }
                        : {}),
                },
            });
            if (existing.status === 'APPROVED') {
                const customer = await tx.customer.findUnique({ where: { phone: existing.phone } });
                const marker = `[Online Request:${existing.id}]`;
                const booking = await tx.booking.findFirst({
                    where: {
                        notes: { contains: marker },
                        courtId: existing.courtId || undefined,
                    },
                });
                if (booking) {
                    const isFullyPaid = paymentStatus === 'PAID' && amount >= booking.totalAmount;
                    await tx.booking.update({
                        where: { id: booking.id },
                        data: {
                            paymentStatus: paymentStatus === 'FAILED'
                                ? 'FAILED'
                                : isFullyPaid ? 'PAID' : 'PENDING',
                            paymentAmount: paymentStatus === 'PAID' ? amount : booking.paymentAmount,
                        },
                    });

                    const invoiceItem = await tx.invoiceItem.findFirst({
                        where: { bookingId: booking.id },
                        include: { invoice: true },
                    });
                    if (invoiceItem) {
                        const depositAmount = paymentStatus === 'PAID'
                            ? amount
                            : invoiceItem.invoice.depositAmount;
                        const receivedAmount = depositAmount + invoiceItem.invoice.paidAmount;
                        const nextInvoiceStatus = receivedAmount >= invoiceItem.invoice.total
                            ? 'PAID'
                            : receivedAmount > 0 ? 'PARTIAL' : 'PENDING';
                        if (invoiceItem.invoice.paymentStatus === 'PAID' && nextInvoiceStatus !== 'PAID') {
                            throw new AppError(400, 'Không thể giảm trạng thái của hóa đơn đã thanh toán');
                        }
                        await tx.invoice.update({
                            where: { id: invoiceItem.invoiceId },
                            data: {
                                paymentStatus: nextInvoiceStatus,
                                depositAmount,
                                paidAt: receivedAmount > 0 ? new Date() : null,
                            },
                        });
                        if (
                            nextInvoiceStatus === 'PAID' &&
                            invoiceItem.invoice.paymentStatus !== 'PAID' &&
                            customer
                        ) {
                            await tx.customer.update({
                                where: { id: customer.id },
                                data: { totalSpent: { increment: invoiceItem.invoice.total } },
                            });
                        }
                    }
                }
            }
            return request;
        });
    }

    async updateStatus(id: string, status: string, userId?: string) {
        if (status === 'APPROVED') {
            const request = await prisma.bookingRequest.findUnique({ where: { id } });
            if (!request) throw new AppError(404, 'Không tìm thấy yêu cầu');
            if (request.status === 'APPROVED') return request;
            const courtId = request.courtId;
            if (!courtId) throw new AppError(400, 'Yêu cầu không còn gắn với sân hợp lệ');

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

            // 2. Create the booking from the server-priced request snapshot.
            const { bookingService } = await import('./booking.service.js');

            const requestMarker = `[Online Request:${request.id}]`;
            const requestOrder = parseBookingOrder(request.orderedItems);
            const requestedTotal = requestOrder.totalAmount ?? request.paymentAmount;
            const amountReceived = request.paymentStatus === 'PAID' ? request.paymentAmount : 0;
            const isFullyPaid = amountReceived >= requestedTotal;
            let booking = await prisma.booking.findFirst({
                where: {
                    courtId,
                    customerId: customer.id,
                    date: request.date,
                    startTime: request.startTime,
                    endTime: request.endTime,
                    notes: { contains: requestMarker },
                },
            });
            if (!booking) {
                const created = await bookingService.create({
                    courtId,
                    customerId: customer.id,
                    date: request.date,
                    startTime: request.startTime,
                    endTime: request.endTime,
                    notes: `${requestMarker} [Online] ${request.notes || ''}`,
                    orderedItems: JSON.stringify(requestOrder.items),
                    voucherCode: request.voucherCode || undefined,
                    discountAmount: request.discountAmount,
                    createdById: userId,
                    paymentMethod: request.paymentMethod,
                    paymentStatus: isFullyPaid ? 'PAID' : 'PENDING',
                    paymentAmount: amountReceived,
                    paymentProof: request.paymentProof || undefined,
                }, {
                    totalAmountOverride: requestedTotal,
                    bookingRequestId: request.id,
                });
                booking = created.booking;
            }

            // Record successful online payment once; invoice rows are built from the booking snapshot.
            if (request.paymentMethod === 'VNPAY') {
                const existingInvoiceItem = await prisma.invoiceItem.findFirst({
                    where: { bookingId: booking.id },
                });
                if (!existingInvoiceItem) {
                    await invoiceService.create({
                        customerId: customer.id,
                        bookingIds: [booking.id],
                        paymentMethod: 'VNPAY',
                        paymentStatus: 'PAID',
                        paidAmount: request.paymentAmount,
                        notes: `Thanh toán VNPAY${request.voucherCode ? ` (Voucher: ${request.voucherCode})` : ''}`,
                    });
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
