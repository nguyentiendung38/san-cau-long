import prisma from '../config/database.js';
import { AppError } from '../middleware/error.js';
import { calculateBookingSnapshot, parseBookingOrder } from '../utils/booking-order.js';

export interface CreateInvoiceInput {
    customerId?: string;
    bookingIds?: string[];
    productItems?: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
    }>;
    serviceItems?: Array<{
        serviceId: string;
        quantity: number;
        unitPrice: number;
    }>;
    discount?: number;
    discountType?: 'PERCENTAGE' | 'FIXED';
    paymentMethod?: string;
    paymentStatus?: string;
    paidAmount?: number;
    depositAmount?: number;
    paidAt?: Date;
    notes?: string;
}

export interface InvoiceQueryParams {
    customerId?: string;
    paymentStatus?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    page?: number;
    limit?: number;
}

export class InvoiceService {
    async findAll(params: InvoiceQueryParams) {
        const { customerId, paymentStatus, startDate, endDate, search, page = 1, limit = 20 } = params;
        const skip = (page - 1) * limit;

        interface WhereClause {
            customerId?: string;
            paymentStatus?: string;
            invoiceNumber?: { contains: string };
            createdAt?: {
                gte?: Date;
                lte?: Date;
            };
        }

        const where: WhereClause = {};

        if (customerId) where.customerId = customerId;
        if (paymentStatus) where.paymentStatus = paymentStatus;
        if (search) where.invoiceNumber = { contains: search };

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        const [invoices, total] = await Promise.all([
            prisma.invoice.findMany({
                where,
                include: {
                    customer: {
                        select: { id: true, name: true, phone: true, membershipTier: true },
                    },
                    items: {
                        include: {
                            booking: { select: { id: true, startTime: true, endTime: true, date: true } },
                            product: { select: { id: true, name: true } },
                            service: { select: { id: true, name: true } },
                        },
                    },
                },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.invoice.count({ where }),
        ]);

        return {
            data: invoices,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async getSummary(params: Pick<InvoiceQueryParams, 'startDate' | 'endDate'>) {
        const where: { createdAt?: { gte?: Date; lte?: Date } } = {};
        if (params.startDate || params.endDate) {
            where.createdAt = {};
            if (params.startDate) where.createdAt.gte = params.startDate;
            if (params.endDate) where.createdAt.lte = params.endDate;
        }
        const [total, pending, paid, revenue] = await Promise.all([
            prisma.invoice.count({ where }),
            prisma.invoice.count({ where: { ...where, paymentStatus: { in: ['PENDING', 'PARTIAL'] } } }),
            prisma.invoice.count({ where: { ...where, paymentStatus: 'PAID' } }),
            prisma.invoice.aggregate({
                where: { ...where, paymentStatus: { in: ['PARTIAL', 'PAID'] } },
                _sum: { paidAmount: true, depositAmount: true },
            }),
        ]);
        return {
            total,
            pending,
            paid,
            totalRevenue: (revenue._sum.paidAmount || 0) + (revenue._sum.depositAmount || 0),
        };
    }

    async findById(id: string) {
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: {
                customer: true,
                items: {
                    include: {
                        booking: {
                            include: { court: { select: { name: true } } },
                        },
                        product: true,
                        service: true,
                    },
                },
            },
        });

        if (!invoice) {
            throw new AppError(404, 'Khong tim thay hoa don');
        }

        return invoice;
    }

    async create(input: CreateInvoiceInput) {
        const { customerId, bookingIds, productItems, serviceItems, discount, discountType, paymentMethod, paymentStatus, paidAmount, depositAmount, paidAt, notes } = input;

        return prisma.$transaction(async (tx) => {
            if (bookingIds?.length) {
                const existingInvoiceItem = await tx.invoiceItem.findFirst({
                    where: { bookingId: { in: bookingIds } },
                });
                if (existingInvoiceItem) {
                    throw new AppError(409, 'Hóa đơn cho lịch đặt này đã tồn tại');
                }
            }

            let subtotal = 0;
            let bookingDiscount = 0;
            let resolvedCustomerId = customerId;
            const items: Array<{
                description: string;
                quantity: number;
                unitPrice: number;
                total: number;
                bookingId?: string;
                productId?: string;
                serviceId?: string;
            }> = [];

            if (bookingIds?.length) {
                const bookings = await tx.booking.findMany({
                    where: { id: { in: bookingIds } },
                    include: { court: { select: { name: true } } },
                });
                if (bookings.length !== new Set(bookingIds).size) {
                    throw new AppError(404, 'Không tìm thấy một hoặc nhiều lịch đặt');
                }

                for (const booking of bookings) {
                    const order = parseBookingOrder(booking.orderedItems);
                    const snapshot = calculateBookingSnapshot(booking.totalAmount, order);
                    const courtAmount = snapshot.courtAmount;
                    items.push({
                        description: `${booking.court.name} - ${booking.startTime} đến ${booking.endTime}`,
                        quantity: 1,
                        unitPrice: courtAmount,
                        total: courtAmount,
                        bookingId: booking.id,
                    });
                    subtotal += courtAmount;
                    bookingDiscount += order.discountAmount;
                    resolvedCustomerId ??= booking.customerId ?? undefined;

                    for (const orderItem of order.items) {
                        const amount = orderItem.quantity * orderItem.price;
                        if (orderItem.type === 'product') {
                            const product = await tx.product.findUnique({ where: { id: orderItem.id } });
                            if (!product) throw new AppError(404, `Không tìm thấy sản phẩm "${orderItem.name}"`);
                            const stockUpdate = await tx.product.updateMany({
                                where: { id: product.id, stock: { gte: orderItem.quantity } },
                                data: { stock: { decrement: orderItem.quantity } },
                            });
                            if (stockUpdate.count !== 1) {
                                throw new AppError(409, `Sản phẩm "${product.name}" không đủ tồn kho`);
                            }
                            items.push({
                                description: product.name,
                                quantity: orderItem.quantity,
                                unitPrice: orderItem.price,
                                total: amount,
                                productId: product.id,
                            });
                        } else {
                            const service = await tx.service.findUnique({ where: { id: orderItem.id } });
                            if (!service) throw new AppError(404, `Không tìm thấy dịch vụ "${orderItem.name}"`);
                            items.push({
                                description: service.name,
                                quantity: orderItem.quantity,
                                unitPrice: orderItem.price,
                                total: amount,
                                serviceId: service.id,
                            });
                        }
                        subtotal += amount;
                    }
                }
            } else {
                for (const item of productItems || []) {
                    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
                        throw new AppError(400, 'Số lượng sản phẩm không hợp lệ');
                    }
                    const product = await tx.product.findUnique({ where: { id: item.productId } });
                    if (!product) throw new AppError(404, 'Không tìm thấy sản phẩm');
                    const stockUpdate = await tx.product.updateMany({
                        where: { id: product.id, stock: { gte: item.quantity } },
                        data: { stock: { decrement: item.quantity } },
                    });
                    if (stockUpdate.count !== 1) throw new AppError(409, `Sản phẩm "${product.name}" không đủ tồn kho`);
                    const amount = item.quantity * product.price;
                    subtotal += amount;
                    items.push({
                        description: product.name,
                        quantity: item.quantity,
                        unitPrice: product.price,
                        total: amount,
                        productId: product.id,
                    });
                }
                for (const item of serviceItems || []) {
                    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
                        throw new AppError(400, 'Số lượng dịch vụ không hợp lệ');
                    }
                    const service = await tx.service.findUnique({ where: { id: item.serviceId } });
                    if (!service) throw new AppError(404, 'Không tìm thấy dịch vụ');
                    const amount = item.quantity * service.price;
                    subtotal += amount;
                    items.push({
                        description: service.name,
                        quantity: item.quantity,
                        unitPrice: service.price,
                        total: amount,
                        serviceId: service.id,
                    });
                }
            }

            let discountAmount = bookingDiscount;
            if (discount && discount > 0) {
                discountAmount += discountType === 'PERCENTAGE'
                    ? subtotal * (discount / 100)
                    : discount;
            }
            if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > subtotal) {
                throw new AppError(400, 'Mức giảm giá hóa đơn không hợp lệ');
            }
            const total = Math.max(0, subtotal - discountAmount);

            const today = new Date();
            const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');
            const count = await tx.invoice.count({
                where: {
                    createdAt: {
                        gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
                    },
                },
            });
            const invoiceNumber = `INV${datePrefix}${String(count + 1).padStart(4, '0')}`;
            const requestedPaymentStatus = paymentStatus || 'PENDING';
            if (!['PENDING', 'PARTIAL', 'PAID'].includes(requestedPaymentStatus)) {
                throw new AppError(400, 'Trạng thái thanh toán không hợp lệ');
            }
            const receivedAmount = (depositAmount || 0) + (paidAmount || 0);
            if (
                !Number.isFinite(receivedAmount) ||
                (depositAmount || 0) < 0 ||
                (paidAmount || 0) < 0 ||
                receivedAmount > total
            ) {
                throw new AppError(400, 'Số tiền đã nhận không hợp lệ');
            }
            if (requestedPaymentStatus === 'PAID' && receivedAmount < total) {
                throw new AppError(400, 'Không thể đánh dấu đã thanh toán khi số tiền thực nhận chưa đủ');
            }
            if (requestedPaymentStatus === 'PARTIAL' && (receivedAmount <= 0 || receivedAmount >= total)) {
                throw new AppError(400, 'Hóa đơn thanh toán một phần phải có số tiền thực nhận nhỏ hơn tổng hóa đơn');
            }
            const finalPaymentStatus = receivedAmount >= total
                ? 'PAID'
                : receivedAmount > 0 ? 'PARTIAL' : 'PENDING';

            const invoice = await tx.invoice.create({
                data: {
                    invoiceNumber,
                    customerId: resolvedCustomerId,
                    subtotal,
                    discount: discountAmount,
                    total,
                    paymentStatus: finalPaymentStatus,
                    paymentMethod,
                    paidAmount: paidAmount || 0,
                    depositAmount: depositAmount || 0,
                    paidAt: paidAt || (receivedAmount > 0 ? new Date() : null),
                    notes,
                    items: { create: items },
                },
                include: {
                    items: true,
                    customer: { select: { name: true, phone: true } },
                },
            });
            if (finalPaymentStatus === 'PAID' && resolvedCustomerId) {
                await tx.customer.update({
                    where: { id: resolvedCustomerId },
                    data: { totalSpent: { increment: total } },
                });
            }
            return invoice;
        });
    }

    async updatePaymentStatus(id: string, paymentStatus: string, paidAmount?: number) {
        if (!['PENDING', 'PARTIAL', 'PAID'].includes(paymentStatus)) {
            throw new AppError(400, 'Trạng thái thanh toán không hợp lệ');
        }
        return prisma.$transaction(async (tx) => {
            const existing = await tx.invoice.findUnique({ where: { id } });
            if (!existing) throw new AppError(404, 'Không tìm thấy hóa đơn');
            if (existing.paymentStatus === 'REFUNDED') {
                throw new AppError(400, 'Không thể cập nhật hóa đơn đã hoàn tiền');
            }
            if (existing.paymentStatus === 'PAID' && paymentStatus !== 'PAID') {
                throw new AppError(400, 'Không thể giảm trạng thái của hóa đơn đã thanh toán');
            }

            const nextPaidAmount = paidAmount !== undefined
                ? paidAmount
                : paymentStatus === 'PAID'
                    ? Math.max(0, existing.total - (existing.depositAmount || 0))
                    : existing.paidAmount;
            const receivedAmount = (existing.depositAmount || 0) + nextPaidAmount;
            if (
                !Number.isFinite(nextPaidAmount) ||
                nextPaidAmount < 0 ||
                receivedAmount > existing.total
            ) {
                throw new AppError(400, 'Số tiền đã nhận không hợp lệ');
            }
            if (paymentStatus === 'PAID' && receivedAmount < existing.total) {
                throw new AppError(400, 'Không thể đánh dấu đã thanh toán khi số tiền thực nhận chưa đủ');
            }
            if (paymentStatus === 'PARTIAL' && (receivedAmount <= 0 || receivedAmount >= existing.total)) {
                throw new AppError(400, 'Hóa đơn thanh toán một phần phải có số tiền thực nhận nhỏ hơn tổng hóa đơn');
            }
            if (paymentStatus === 'PENDING' && receivedAmount > 0) {
                throw new AppError(400, 'Hóa đơn đã ghi nhận tiền cần ở trạng thái thanh toán một phần');
            }

            const invoice = await tx.invoice.update({
                where: { id },
                data: {
                    paymentStatus,
                    paidAmount: nextPaidAmount,
                    paidAt: receivedAmount > 0 ? new Date() : null,
                },
                include: {
                    customer: { select: { id: true, name: true } },
                },
            });

            if (paymentStatus === 'PAID' && existing.paymentStatus !== 'PAID' && invoice.customerId) {
                await tx.customer.update({
                    where: { id: invoice.customerId },
                    data: { totalSpent: { increment: invoice.total } },
                });
            }
            return invoice;
        });
    }

    async delete(id: string) {
        return prisma.$transaction(async (tx) => {
            const existing = await tx.invoice.findUnique({
                where: { id },
                include: { items: true },
            });
            if (!existing) throw new AppError(404, 'Không tìm thấy hóa đơn');
            if (existing.paymentStatus === 'PAID' || existing.paymentStatus === 'PARTIAL') {
                throw new AppError(400, 'Không thể xóa hóa đơn đã ghi nhận thanh toán; hãy thực hiện quy trình hủy/hoàn tiền');
            }
            if (existing.paymentStatus !== 'REFUNDED') {
                for (const item of existing.items) {
                    if (item.productId) {
                        await tx.product.update({
                            where: { id: item.productId },
                            data: { stock: { increment: item.quantity } },
                        });
                    }
                }
            }
            return tx.invoice.delete({ where: { id } });
        });
    }

    async cancel(id: string, reason?: string) {
        return prisma.$transaction(async (tx) => {
            const existing = await tx.invoice.findUnique({
                where: { id },
                include: { items: true },
            });
            if (!existing) throw new AppError(404, 'Không tìm thấy hóa đơn');
            if (existing.paymentStatus === 'PAID') {
                throw new AppError(400, 'Không thể hủy hóa đơn đã thanh toán');
            }
            if (existing.paymentStatus === 'REFUNDED') return existing;

            const invoice = await tx.invoice.update({
                where: { id },
                data: {
                    paymentStatus: 'REFUNDED',
                    notes: reason ? `${existing.notes || ''}\n[Hủy]: ${reason}` : existing.notes,
                },
                include: { items: true },
            });
            for (const item of existing.items) {
                if (item.productId) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { increment: item.quantity } },
                    });
                }
            }
            return invoice;
        });
    }

    // Get daily revenue summary  
    async getDailySummary(date: Date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const invoices = await prisma.invoice.findMany({
            where: {
                paymentStatus: { in: ['PARTIAL', 'PAID'] },
                paidAt: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
            include: {
                items: true,
            },
        });

        let totalRevenue = 0;

        for (const invoice of invoices) {
            totalRevenue += invoice.paidAmount + invoice.depositAmount;
        }

        return {
            date: date.toISOString().split('T')[0],
            invoiceCount: invoices.length,
            totalRevenue,
        };
    }
}

export const invoiceService = new InvoiceService();
