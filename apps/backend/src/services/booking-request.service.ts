import prisma from '../config/database.js';
import { AppError } from '../middleware/error.js';
import { voucherService } from './voucher.service.js';
import { isWithinOperatingHours, timeToMinutes } from '../utils/booking-rules.js';
import { parseBookingOrder } from '../utils/booking-order.js';
import { invoiceService } from './invoice.service.js';
import { getBankTransferExpiry, isBookingStartInFuture, isChangeRequestBeforeDeadline } from '../utils/booking-request-policy.js';
import { randomBytes } from 'node:crypto';
import { maintenanceClosureService, bookingInterval } from './maintenance-closure.service.js';
import { notificationService, safelyQueueNotification } from './notification.service.js';
import {
    LOYALTY_POINT_VALUE_VND,
    awardInvoicePoints,
    adjustBookingPointRedemption,
    getMaxRedeemPoints,
    redeemBookingPoints,
    releaseBookingPointReservation,
} from './loyalty.service.js';

interface RequestedOrderItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    type: 'product' | 'service';
}

export class BookingRequestService {
    private getReceivedAmount(request: {
        paymentStatus: string;
        paymentAmount: number;
        orderedItems: string | null;
    }) {
        try {
            const snapshot = request.orderedItems ? JSON.parse(request.orderedItems) : null;
            if (Number.isFinite(snapshot?.paidAmount) && snapshot.paidAmount >= 0) {
                return snapshot.paidAmount;
            }
        } catch {
            // Older booking requests do not store a payment snapshot.
        }
        return request.paymentStatus === 'PAID' ? request.paymentAmount : 0;
    }

    private async calculateReschedulePrice(
        request: {
            courtId: string | null;
            customerId: string | null;
            orderedItems: string | null;
            discountAmount: number;
            redeemPoints: number;
        },
        date: Date,
        startTime: string,
        endTime: string,
    ) {
        if (!request.courtId) throw new AppError(400, 'Yêu cầu đặt sân không còn gắn với sân hợp lệ');
        const { BookingService } = await import('./booking.service.js');
        const pricing = await new BookingService().calculatePrice(request.courtId, date, startTime, endTime);
        if (pricing.total <= 0 || pricing.appliedRule?.startsWith('Chưa thiết lập giá')) {
            throw new AppError(400, 'Khung giờ mới chưa có bảng giá đầy đủ');
        }

        const order = parseBookingOrder(request.orderedItems);
        const itemsTotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const subtotal = pricing.total + itemsTotal;
        const voucherDiscount = Math.min(request.discountAmount || 0, subtotal);
        const customer = request.customerId
            ? await prisma.customer.findUnique({
                where: { id: request.customerId },
                select: { isVerifiedHue: true },
            })
            : null;
        const hueDiscount = customer?.isVerifiedHue
            ? Math.min(Math.round(pricing.total * 0.2), Math.max(0, subtotal - voucherDiscount))
            : 0;
        const maxRedeemPoints = getMaxRedeemPoints(pricing.total, request.redeemPoints || 0);
        const availableForPoints = Math.max(0, subtotal - voucherDiscount - hueDiscount);
        const redeemPoints = Math.min(maxRedeemPoints, Math.floor(availableForPoints / LOYALTY_POINT_VALUE_VND));
        const loyaltyDiscount = redeemPoints * LOYALTY_POINT_VALUE_VND;
        const totalAmount = Math.max(0, subtotal - voucherDiscount - loyaltyDiscount - hueDiscount);
        return {
            items: order.items,
            subtotal,
            totalAmount,
            discountAmount: voucherDiscount + loyaltyDiscount + hueDiscount,
            voucherCode: order.voucherCode,
            hueDiscountAmount: hueDiscount,
            loyaltyDiscountAmount: loyaltyDiscount,
            redeemPoints,
        };
    }

    async expireUnpaidBankTransferRequests(now = new Date()) {
        const expired = await prisma.bookingRequest.findMany({
            where: {
                status: 'PENDING',
                paymentStatus: { not: 'PAID' },
                paymentMethod: 'DEPOSIT_TRANSFER',
                expiresAt: { lte: now },
            },
            select: { id: true },
            take: 100,
        });
        let count = 0;
        for (const { id } of expired) {
            const didExpire = await prisma.$transaction(async (tx) => {
                const result = await tx.bookingRequest.updateMany({
                    where: {
                        id,
                        status: 'PENDING',
                        paymentStatus: { not: 'PAID' },
                        paymentMethod: 'DEPOSIT_TRANSFER',
                        expiresAt: { lte: now },
                    },
                    data: {
                        status: 'EXPIRED',
                        paymentStatus: 'FAILED',
                    },
                });
                if (result.count !== 1) return false;
                const request = await tx.bookingRequest.findUnique({ where: { id } });
                if (request) {
                    await tx.bookingRequest.update({
                        where: { id },
                        data: { notes: `[Hết hạn thanh toán sau 30 phút] ${request.notes || ''}`.trim() },
                    });
                    await releaseBookingPointReservation(tx, request);
                }
                return true;
            });
            if (didExpire) {
                count += 1;
                try {
                    const request = await prisma.bookingRequest.findUnique({ where: { id } });
                    if (request) await safelyQueueNotification(notificationService.bookingExpired(request), 'hết hạn');
                } catch (error) {
                    console.error('Không thể xếp email hết hạn vào hàng đợi:', error instanceof Error ? error.message : error);
                }
            }
        }
        return count;
    }

    async create(data: any) {
        await this.expireUnpaidBankTransferRequests();
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
        const paymentMethod = data.paymentMethod || 'DEPOSIT_TRANSFER';
        if (!['DEPOSIT_TRANSFER', 'VNPAY', 'MOMO'].includes(paymentMethod)) {
            throw new AppError(400, 'Phương thức thanh toán không hợp lệ');
        }
        if (
            paymentMethod === 'DEPOSIT_TRANSFER' &&
            (!court.venue.bankCode || !court.venue.bankAccountNumber || !court.venue.bankAccountName)
        ) {
            throw new AppError(400, 'Cơ sở chưa cấu hình tài khoản nhận chuyển khoản');
        }
        if (typeof data.customerId !== 'string' || !data.customerId) {
            throw new AppError(401, 'Vui lòng đăng nhập để gửi yêu cầu đặt sân');
        }
        const customer = await prisma.customer.findUnique({
            where: { id: data.customerId },
            select: {
                id: true,
                phone: true,
                points: true,
                reservedPoints: true,
                isVerifiedHue: true,
            },
        });
        if (!customer || customer.phone.trim() !== String(data.phone || '').trim()) {
            throw new AppError(403, 'Số điện thoại đặt sân phải trùng với tài khoản đã đăng nhập');
        }
        const customerId = customer.id;
        const customerReservedPoints = customer.reservedPoints;
        
        
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
        // Kiểm tra giờ mở cửa cơ sở
        const venueOpenMinutes = timeToMinutes(court.venue.openTime || '06:00');
        const venueCloseMinutes = timeToMinutes(court.venue.closeTime || '23:00');
        if (
            venueOpenMinutes !== null &&
            venueCloseMinutes !== null &&
            (startMinutes < venueOpenMinutes || endMinutes > venueCloseMinutes)
        ) {
            throw new AppError(
                400,
                `Cơ sở ${court.venue.name} chỉ mở cửa từ ${court.venue.openTime || '06:00'} đến ${court.venue.closeTime || '23:00'}. Khung giờ bạn chọn nằm ngoài thời gian mở cửa.`
            );
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
                    { paymentMethod: 'DEPOSIT_TRANSFER', expiresAt: { gt: new Date() } },
                    { paymentMethod: 'VNPAY', createdAt: { gte: fifteenMinsAgo } },
                    { paymentMethod: { notIn: ['DEPOSIT_TRANSFER', 'VNPAY'] } },
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
        await maintenanceClosureService.ensureAvailable(data.courtId, dateObj, data.startTime, data.endTime);

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
        const hueDiscountAmount = customer.isVerifiedHue
            ? Math.round(pricing.total * 0.2)
            : 0;

        let discountAmount = 0;
        const redeemPoints = data.redeemPoints ?? 0;
        if (!Number.isInteger(redeemPoints) || redeemPoints < 0) {
            throw new AppError(400, 'Số điểm sử dụng không hợp lệ');
        }
        let voucherCode: string | undefined;
        if (data.voucherCode) {
            const voucherResult = await voucherService.validate(data.voucherCode, subtotal);
            discountAmount = voucherResult.discountAmount;
            paymentAmount = Math.max(0, paymentAmount - discountAmount);
            voucherCode = voucherResult.voucher.code;
        }
        paymentAmount = Math.max(0, paymentAmount - hueDiscountAmount);

        const availablePoints = customer.points - customer.reservedPoints;
        const maxRedeemPoints = getMaxRedeemPoints(pricing.total, availablePoints);
        if (redeemPoints > maxRedeemPoints) {
            throw new AppError(400, `Tối đa có thể đổi ${maxRedeemPoints} điểm cho tiền sân này`);
        }
        const loyaltyDiscountAmount = redeemPoints * LOYALTY_POINT_VALUE_VND;
        if (loyaltyDiscountAmount > paymentAmount) {
            throw new AppError(400, 'Điểm đổi vượt quá số tiền còn phải thanh toán');
        }
        paymentAmount -= loyaltyDiscountAmount;

        const createdAt = new Date();
        const isFreeBooking = paymentAmount === 0;
        const expiresAt = paymentMethod === 'DEPOSIT_TRANSFER' && !isFreeBooking
            ? getBankTransferExpiry(createdAt)
            : null;
        const transferReference = paymentMethod === 'DEPOSIT_TRANSFER' && !isFreeBooking
            ? `HUE${randomBytes(5).toString('hex').toUpperCase()}`
            : null;
        const request = await prisma.$transaction(async (tx) => {
            const interval = bookingInterval(dateObj, data.startTime, data.endTime);
            const transactionClosure = await tx.maintenanceClosure.findFirst({
                where: {
                    courtId: data.courtId,
                    startAt: { lt: interval.endAt },
                    endAt: { gt: interval.startAt },
                },
                select: { id: true, closureType: true },
            });
            if (transactionClosure) {
                throw new AppError(
                    409,
                    transactionClosure.closureType === 'TOURNAMENT'
                        ? 'Sân đang tổ chức giải trong khung giờ này'
                        : 'Sân đang đóng bảo trì trong khung giờ này',
                );
            }
            const transactionBookings = await tx.booking.findMany({
                where: {
                    courtId: data.courtId,
                    date: { gte: dateObjStart, lte: dateObjEnd },
                    status: { notIn: ['CANCELLED', 'COMPLETED'] },
                },
                select: { startTime: true, endTime: true },
            });
            const transactionRequests = await tx.bookingRequest.findMany({
                where: {
                    courtId: data.courtId,
                    date: { gte: dateObjStart, lte: dateObjEnd },
                    status: 'PENDING',
                    createdAt,
                    paymentStatus: { not: 'FAILED' },
                    OR: [
                        { paymentMethod: 'DEPOSIT_TRANSFER', expiresAt: { gt: new Date() } },
                        { paymentMethod: 'VNPAY', createdAt: { gte: fifteenMinsAgo } },
                        { paymentMethod: { notIn: ['DEPOSIT_TRANSFER', 'VNPAY'] } },
                    ],
                },
                select: { startTime: true, endTime: true },
            });
            if ([...transactionBookings, ...transactionRequests].some((reservation) =>
                data.startTime < reservation.endTime && reservation.startTime < data.endTime,
            )) {
                throw new AppError(409, 'Khung giờ vừa được giữ bởi yêu cầu khác. Vui lòng tải lại lịch.');
            }
            if (redeemPoints > 0) {
                const reservation = await tx.customer.updateMany({
                    where: {
                        id: customerId,
                        points: { gte: redeemPoints + customerReservedPoints },
                        reservedPoints: customerReservedPoints,
                    },
                    data: { reservedPoints: { increment: redeemPoints } },
                });
                if (reservation.count !== 1) {
                    throw new AppError(409, 'Số dư điểm khả dụng đã thay đổi. Vui lòng tải lại và thử lại.');
                }
            }
            return tx.bookingRequest.create({
                data: {
                    venueId: data.venueId,
                    courtId: data.courtId,
                    customerId,
                    name: data.name,
                    phone: data.phone,
                    date: new Date(data.date),
                    startTime: data.startTime,
                    endTime: data.endTime,
                    notes: data.notes,
                    status: 'PENDING',
                    paymentMethod,
                    paymentStatus: isFreeBooking ? 'PAID' : 'PENDING',
                    paymentAmount,
                    paymentProof: data.paymentProof,
                    expiresAt,
                    transferReference,
                    redeemPoints,
                    loyaltyDiscountAmount,
                    hueDiscountAmount,
                    orderedItems: JSON.stringify({
                        items: orderItems,
                        subtotal,
                        totalAmount: paymentAmount,
                        discountAmount: discountAmount + loyaltyDiscountAmount + hueDiscountAmount,
                        voucherCode,
                        ...(isFreeBooking ? { paidAmount: 0 } : {}),
                    }),
                    voucherCode,
                    discountAmount,
                },
            });
        });
        if (paymentMethod === 'DEPOSIT_TRANSFER' && !isFreeBooking) {
            await safelyQueueNotification(notificationService.paymentDeadline(request), 'deadline thanh toán');
        }
        return request;
    }

    async getAll(venueId?: string) {
        await this.expireUnpaidBankTransferRequests();
        return prisma.bookingRequest.findMany({
            where: venueId ? { venueId } : {},
            orderBy: { createdAt: 'desc' },
            include: {
                venue: { select: { name: true } },
                court: { select: { name: true } },
            }
        });
    }

    async getByCustomerId(customerId: string) {
        await this.expireUnpaidBankTransferRequests();
        const requests = await prisma.bookingRequest.findMany({
            where: { customerId },
            orderBy: { createdAt: 'desc' },
            include: {
                venue: { select: { name: true, address: true, logo: true } },
                court: { select: { name: true } },
            }
        });
        return Promise.all(requests.map(async (request) => {
            let booking: {
                id: string;
                checkInToken: string | null;
                checkedInAt: Date | null;
                status: string;
            } | null = await prisma.booking.findFirst({
                where: {
                    notes: { contains: `[Online Request:${request.id}]` },
                    customerId,
                    status: { not: 'CANCELLED' },
                },
                select: { id: true, checkInToken: true, checkedInAt: true, status: true },
            });
            if (booking && !booking.checkInToken && ['CONFIRMED', 'IN_PROGRESS'].includes(booking.status)) {
                await prisma.booking.updateMany({
                    where: { id: booking.id, checkInToken: null, status: { in: ['CONFIRMED', 'IN_PROGRESS'] } },
                    data: { checkInToken: randomBytes(32).toString('base64url') },
                });
                booking = await prisma.booking.findUnique({
                    where: { id: booking.id },
                    select: { id: true, checkInToken: true, checkedInAt: true, status: true },
                });
            }
            return { ...request, checkIn: booking };
        }));
    }

    async getByPhone(phone: string) {
        await this.expireUnpaidBankTransferRequests();
        const cleanPhone = phone.trim();
        const requests = await prisma.bookingRequest.findMany({
            where: { phone: cleanPhone },
            orderBy: { createdAt: 'desc' },
            include: {
                venue: { select: { name: true, address: true, logo: true, bankCode: true, bankAccountNumber: true, bankAccountName: true } },
                court: { select: { name: true } },
            }
        });
        return Promise.all(requests.map(async (request) => {
            let booking: {
                id: string;
                checkInToken: string | null;
                checkedInAt: Date | null;
                status: string;
            } | null = await prisma.booking.findFirst({
                where: {
                    notes: { contains: `[Online Request:${request.id}]` },
                    status: { not: 'CANCELLED' },
                },
                select: { id: true, checkInToken: true, checkedInAt: true, status: true },
            });
            if (booking && !booking.checkInToken && ['CONFIRMED', 'IN_PROGRESS'].includes(booking.status)) {
                await prisma.booking.updateMany({
                    where: { id: booking.id, checkInToken: null, status: { in: ['CONFIRMED', 'IN_PROGRESS'] } },
                    data: { checkInToken: randomBytes(32).toString('base64url') },
                });
                booking = await prisma.booking.findUnique({
                    where: { id: booking.id },
                    select: { id: true, checkInToken: true, checkedInAt: true, status: true },
                });
            }
            return { ...request, checkIn: booking };
        }));
    }

    async requestCancellation(
        id: string,
        customerIdOrPhone: string,
        reason: string,
        change: { type?: 'CANCELLATION' | 'RESCHEDULE'; date?: Date; startTime?: string; endTime?: string } = {},
    ) {
        const request = await prisma.bookingRequest.findUnique({ where: { id } });
        if (!request) throw new AppError(404, 'Không tìm thấy yêu cầu đặt sân');
        const isMatch = request.customerId === customerIdOrPhone || Boolean(request.phone && customerIdOrPhone && request.phone.trim() === customerIdOrPhone.trim());
        if (!isMatch) {
            throw new AppError(403, 'Bạn không có quyền thao tác yêu cầu đặt sân này');
        }
        if (!['PENDING', 'APPROVED'].includes(request.status)) {
            throw new AppError(400, 'Chỉ có thể yêu cầu hủy lịch đang chờ hoặc đã được xác nhận');
        }
        if (!isChangeRequestBeforeDeadline(request.date, request.startTime)) {
            throw new AppError(400, 'Yêu cầu đổi hoặc hủy phải được gửi trước giờ bắt đầu ít nhất 24 giờ');
        }
        if (request.cancellationRequestStatus === 'PENDING') {
            throw new AppError(409, 'Yêu cầu hủy lịch này đang chờ cơ sở xử lý');
        }

        const isReschedule = change.type === 'RESCHEDULE';
        if (isReschedule) {
            if (!change.date || !change.startTime || !change.endTime) {
                throw new AppError(400, 'Vui lòng chọn ngày và khung giờ mới');
            }
            if (!isChangeRequestBeforeDeadline(change.date, change.startTime)) {
                throw new AppError(400, 'Khung giờ mới phải cách thời điểm gửi ít nhất 24 giờ');
            }
            const start = timeToMinutes(change.startTime);
            const end = timeToMinutes(change.endTime);
            if (start === null || end === null || start >= end || start % 30 !== 0 || end % 30 !== 0) {
                throw new AppError(400, 'Khung giờ mới không hợp lệ');
            }
            const operatingHours = await prisma.operatingHour.findMany({
                where: { venueId: request.venueId, isActive: true },
            });
            if (!isWithinOperatingHours(operatingHours, change.date.getUTCDay(), change.startTime, change.endTime)) {
                throw new AppError(400, 'Khung giờ mới nằm ngoài giờ hoạt động của cơ sở');
            }
            const quote = await this.calculateReschedulePrice(
                request,
                change.date,
                change.startTime,
                change.endTime,
            );
            let orderSnapshot: Record<string, unknown> = {};
            try {
                orderSnapshot = request.orderedItems ? JSON.parse(request.orderedItems) : {};
            } catch {
                throw new AppError(400, 'Chi tiết dịch vụ trong lịch đặt không hợp lệ');
            }
            const paidAmount = this.getReceivedAmount(request);
            const updated = await prisma.bookingRequest.update({
                where: { id },
                data: {
                    cancellationRequestStatus: 'PENDING',
                    cancellationRequestType: 'RESCHEDULE',
                    cancellationRequestReason: reason,
                    cancellationRequestedAt: new Date(),
                    cancellationReviewedAt: null,
                    requestedDate: change.date,
                    requestedStartTime: change.startTime,
                    requestedEndTime: change.endTime,
                    orderedItems: JSON.stringify({
                        ...orderSnapshot,
                        requestedTotalAmount: quote.totalAmount,
                        requestedRedeemPoints: quote.redeemPoints,
                        paidAmount,
                        refundDueAmount: Math.max(0, paidAmount - quote.totalAmount),
                    }),
                },
            });
            await safelyQueueNotification(notificationService.bookingChangeRequest(updated, 'SUBMITTED'), 'yêu cầu đổi/hủy lịch');
            return updated;
        }
        const updated = await prisma.bookingRequest.update({
            where: { id },
            data: {
                cancellationRequestStatus: 'PENDING',
                cancellationRequestType: isReschedule ? 'RESCHEDULE' : 'CANCELLATION',
                cancellationRequestReason: reason,
                cancellationRequestedAt: new Date(),
                cancellationReviewedAt: null,
                requestedDate: isReschedule ? change.date : null,
                requestedStartTime: isReschedule ? change.startTime : null,
                requestedEndTime: isReschedule ? change.endTime : null,
            },
        });
        await safelyQueueNotification(notificationService.bookingChangeRequest(updated, 'SUBMITTED'), 'yêu cầu đổi/hủy lịch');
        return updated;
    }

    async reviewCancellationRequest(id: string, status: 'APPROVED' | 'REJECTED', reason?: string) {
        await this.expireUnpaidBankTransferRequests();
        const updated = await prisma.$transaction(async (tx) => {
            const request = await tx.bookingRequest.findUnique({ where: { id } });
            if (!request) throw new AppError(404, 'Không tìm thấy yêu cầu đặt sân');
            if (request.cancellationRequestStatus !== 'PENDING') {
                throw new AppError(409, 'Yêu cầu hủy không còn ở trạng thái chờ xử lý');
            }
            if (status === 'APPROVED' && !isBookingStartInFuture(request.date, request.startTime)) {
                throw new AppError(400, 'Không thể duyệt hủy sau khi lịch đã bắt đầu');
            }

            const isReschedule = request.cancellationRequestType === 'RESCHEDULE';
            if (status === 'APPROVED' && isReschedule) {
                if (!request.requestedDate || !request.requestedStartTime || !request.requestedEndTime) {
                    throw new AppError(409, 'Yêu cầu đổi lịch không có khung giờ mới');
                }
                const operatingHours = await tx.operatingHour.findMany({
                    where: { venueId: request.venueId, isActive: true },
                });
                if (!isWithinOperatingHours(
                    operatingHours,
                    request.requestedDate.getUTCDay(),
                    request.requestedStartTime,
                    request.requestedEndTime,
                )) {
                    throw new AppError(409, 'Khung giờ mới hiện không nằm trong giờ hoạt động');
                }
                const newDayStart = new Date(Date.UTC(
                    request.requestedDate.getUTCFullYear(),
                    request.requestedDate.getUTCMonth(),
                    request.requestedDate.getUTCDate(),
                ));
                const newDayEnd = new Date(newDayStart.getTime() + 24 * 60 * 60_000 - 1);
                const bookingMarker = `[Online Request:${request.id}]`;
                const linkedBooking = request.status === 'APPROVED'
                    ? await tx.booking.findFirst({ where: { notes: { contains: bookingMarker }, courtId: request.courtId || undefined } })
                    : null;
                const conflicts = await tx.booking.findMany({
                    where: {
                        courtId: request.courtId || undefined,
                        date: { gte: newDayStart, lte: newDayEnd },
                        status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
                        ...(linkedBooking ? { id: { not: linkedBooking.id } } : {}),
                    },
                    select: { startTime: true, endTime: true },
                });
                if (conflicts.some((booking) =>
                    request.requestedStartTime! < booking.endTime && booking.startTime < request.requestedEndTime!,
                )) {
                    throw new AppError(409, 'Khung giờ mới đã có lịch đặt khác');
                }
                const pendingRequests = await tx.bookingRequest.findMany({
                    where: {
                        id: { not: request.id },
                        courtId: request.courtId || undefined,
                        date: { gte: newDayStart, lte: newDayEnd },
                        status: 'PENDING',
                        paymentStatus: { not: 'FAILED' },
                    },
                    select: { startTime: true, endTime: true },
                });
                if (pendingRequests.some((pending) =>
                    request.requestedStartTime! < pending.endTime && pending.startTime < request.requestedEndTime!,
                )) {
                    throw new AppError(409, 'Khung giờ mới đang được giữ bởi một yêu cầu khác');
                }
                const interval = bookingInterval(request.requestedDate, request.requestedStartTime, request.requestedEndTime);
                const maintenance = await tx.maintenanceClosure.findFirst({
                    where: { courtId: request.courtId || undefined, startAt: { lt: interval.endAt }, endAt: { gt: interval.startAt } },
                    select: { id: true, closureType: true },
                });
                if (maintenance) {
                    throw new AppError(
                        409,
                        maintenance.closureType === 'TOURNAMENT'
                            ? 'Sân đang tổ chức giải trong khung giờ mới'
                            : 'Sân đang đóng bảo trì trong khung giờ mới',
                    );
                }
                const quote = await this.calculateReschedulePrice(
                    request,
                    request.requestedDate,
                    request.requestedStartTime,
                    request.requestedEndTime,
                );
                await adjustBookingPointRedemption(
                    tx,
                    request,
                    quote.redeemPoints,
                    request.cancellationRequestedAt?.toISOString() || new Date().toISOString(),
                );
                const paidAmount = this.getReceivedAmount(request);
                const paymentStatus = paidAmount >= quote.totalAmount ? 'PAID' : 'PENDING';
                let orderSnapshot: Record<string, unknown> = {};
                try {
                    orderSnapshot = request.orderedItems ? JSON.parse(request.orderedItems) : {};
                } catch {
                    throw new AppError(400, 'Chi tiết dịch vụ trong lịch đặt không hợp lệ');
                }
                const updatedOrder = JSON.stringify({
                    ...orderSnapshot,
                    ...quote,
                    paidAmount,
                    refundDueAmount: Math.max(0, paidAmount - quote.totalAmount),
                    requestedTotalAmount: undefined,
                    requestedRedeemPoints: undefined,
                });
                await tx.bookingRequest.update({
                    where: { id: request.id },
                    data: {
                        paymentAmount: quote.totalAmount,
                        paymentStatus,
                        redeemPoints: quote.redeemPoints,
                        loyaltyDiscountAmount: quote.loyaltyDiscountAmount,
                        hueDiscountAmount: quote.hueDiscountAmount,
                        orderedItems: updatedOrder,
                    },
                });
                if (linkedBooking) {
                    const totalDiscount = quote.discountAmount;
                    await tx.booking.update({
                        where: { id: linkedBooking.id },
                        data: {
                            date: request.requestedDate,
                            startTime: request.requestedStartTime,
                            endTime: request.requestedEndTime,
                            totalAmount: quote.totalAmount,
                            orderedItems: JSON.stringify({
                                items: quote.items,
                                discountAmount: totalDiscount,
                                voucherCode: quote.voucherCode,
                            }),
                            paymentStatus,
                            paymentAmount: paidAmount,
                        },
                    });
                    const invoiceItem = await tx.invoiceItem.findFirst({
                        where: { bookingId: linkedBooking.id },
                        include: { invoice: true },
                    });
                    if (invoiceItem) {
                        const invoiceReceived = paidAmount;
                        const invoiceStatus = invoiceReceived >= quote.totalAmount
                            ? 'PAID'
                            : invoiceReceived > 0 ? 'PARTIAL' : 'PENDING';
                        const countedMatch = invoiceItem.invoice.notes?.match(/\[BookingRequestCountedTotal:(\d+(?:\.\d+)?)\]/);
                        const countedTotal = countedMatch
                            ? Number(countedMatch[1])
                            : invoiceItem.invoice.paymentStatus === 'PAID' ? invoiceItem.invoice.total : 0;
                        const invoiceNotes = (invoiceItem.invoice.notes || '')
                            .replace(/\s*\[BookingRequestCountedTotal:\d+(?:\.\d+)?\]/, '')
                            .replace(/\s*\[Cần Admin xử lý hoàn \d+đ do đổi lịch\]/, '');
                        const adjustmentNotes = paidAmount > quote.totalAmount
                            ? ` [Cần Admin xử lý hoàn ${paidAmount - quote.totalAmount}đ do đổi lịch]`
                            : '';
                        await tx.invoiceItem.update({
                            where: { id: invoiceItem.id },
                            data: {
                                description: `${invoiceItem.description.split(' - ')[0]} - ${request.requestedStartTime} đến ${request.requestedEndTime}`,
                                unitPrice: quote.subtotal - quote.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
                                total: quote.subtotal - quote.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
                            },
                        });
                        await tx.invoice.update({
                            where: { id: invoiceItem.invoiceId },
                            data: {
                                subtotal: quote.subtotal,
                                discount: totalDiscount,
                                total: quote.totalAmount,
                                paymentStatus: invoiceStatus,
                                depositAmount: paidAmount,
                                paidAmount: 0,
                                paidAt: invoiceReceived > 0 ? new Date() : null,
                                notes: `${invoiceNotes} [BookingRequestCountedTotal:${countedTotal}]${adjustmentNotes}`.trim(),
                            },
                        });
                    }
                }
            }

            if (status === 'APPROVED' && request.status === 'APPROVED' && !isReschedule) {
                const bookingMarker = `[Online Request:${request.id}]`;
                const result = await tx.booking.updateMany({
                    where: {
                        courtId: request.courtId || undefined,
                        date: request.date,
                        notes: { contains: bookingMarker },
                        status: { not: 'CANCELLED' },
                    },
                    data: { status: 'CANCELLED' },
                });
                if (result.count === 0) {
                    throw new AppError(409, 'Không tìm thấy lịch đã xác nhận để hủy; vui lòng kiểm tra lịch sân');
                }
            }

            const notes = reason?.trim()
                ? `[Admin xử lý yêu cầu ${isReschedule ? 'đổi lịch' : 'hủy'}: ${reason.trim()}] ${request.notes || ''}`.trim()
                : request.notes;
            const updatedRequest = await tx.bookingRequest.update({
                where: { id },
                data: {
                    cancellationRequestStatus: status,
                    cancellationReviewedAt: new Date(),
                    ...(notes ? { notes } : {}),
                    ...(status === 'APPROVED' && !isReschedule ? { status: 'CANCELLED' } : {}),
                    ...(status === 'APPROVED' && isReschedule
                        ? {
                            date: request.requestedDate!,
                            startTime: request.requestedStartTime!,
                            endTime: request.requestedEndTime!,
                        }
                        : {}),
                },
            });
            if (status === 'APPROVED' && !isReschedule) {
                await releaseBookingPointReservation(tx, updatedRequest);
            }
            return updatedRequest;
        });
        await safelyQueueNotification(
            notificationService.bookingChangeRequest(updated, status),
            'kết quả yêu cầu đổi/hủy lịch',
        );
        return updated;
    }

    async updatePaymentStatus(id: string, paymentStatus: string, paymentAmount?: number) {
        if (!['PENDING', 'PAID', 'FAILED'].includes(paymentStatus)) {
            throw new AppError(400, 'Trạng thái thanh toán không hợp lệ');
        }
        await this.expireUnpaidBankTransferRequests();
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
            if (paymentStatus === 'PAID' && !['PENDING', 'APPROVED'].includes(existing.status)) {
                throw new AppError(409, 'Yêu cầu đã hết hạn hoặc kết thúc; không thể xác nhận thanh toán. Hãy xử lý hoàn tiền và tạo yêu cầu mới.');
            }
            if (paymentStatus === 'PAID' && amount < requestedTotal) {
                throw new AppError(400, 'Chỉ xác nhận đã thanh toán khi số tiền nhận đủ tổng tiền đặt sân');
            }

            const request = await tx.bookingRequest.update({
                where: { id },
                data: {
                    paymentStatus,
                    ...(paymentStatus === 'PAID' ? { paymentAmount: requestedTotal } : {}),
                    ...(paymentStatus === 'PAID' || requestOrder.totalAmount === undefined
                        ? {
                            orderedItems: JSON.stringify({
                                ...(() => {
                                    try {
                                        return existing.orderedItems ? JSON.parse(existing.orderedItems) : {};
                                    } catch {
                                        throw new AppError(400, 'Chi tiết dịch vụ trong lịch đặt không hợp lệ');
                                    }
                                })(),
                                items: requestOrder.items,
                                discountAmount: requestOrder.discountAmount || existing.discountAmount || 0,
                                voucherCode: requestOrder.voucherCode || existing.voucherCode || undefined,
                                totalAmount: requestedTotal,
                                ...(paymentStatus === 'PAID' ? { paidAmount: amount } : {}),
                            }),
                        }
                        : {}),
                },
            });
            if (request.status === 'APPROVED' && request.paymentStatus === 'PAID') {
                await redeemBookingPoints(tx, request);
            } else if (request.status === 'REJECTED' || request.status === 'CANCELLED') {
                await releaseBookingPointReservation(tx, request);
            }
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
                        const updatedInvoice = await tx.invoice.update({
                            where: { id: invoiceItem.invoiceId },
                            data: {
                                paymentStatus: nextInvoiceStatus,
                                depositAmount,
                                paidAmount: 0,
                                paidAt: receivedAmount > 0 ? new Date() : null,
                            },
                        });
                        if (
                            nextInvoiceStatus === 'PAID' &&
                            invoiceItem.invoice.paymentStatus !== 'PAID' &&
                            customer
                        ) {
                            const countedMatch = invoiceItem.invoice.notes?.match(/\[BookingRequestCountedTotal:(\d+(?:\.\d+)?)\]/);
                            const previouslyCounted = countedMatch
                                ? Number(countedMatch[1])
                                : 0;
                            await tx.customer.update({
                                where: { id: customer.id },
                                data: { totalSpent: { increment: Math.max(0, invoiceItem.invoice.total - previouslyCounted) } },
                            });
                        }
                        if (nextInvoiceStatus === 'PAID' && invoiceItem.invoice.paymentStatus !== 'PAID') {
                            await awardInvoicePoints(tx, updatedInvoice);
                            const invoiceNotes = (invoiceItem.invoice.notes || '')
                                .replace(/\s*\[BookingRequestCountedTotal:\d+(?:\.\d+)?\]/, '');
                            await tx.invoice.update({
                                where: { id: invoiceItem.invoiceId },
                                data: {
                                    notes: `${invoiceNotes} [BookingRequestCountedTotal:${invoiceItem.invoice.total}]`.trim(),
                                },
                            });
                        }
                    }
                }
            }
            return request;
        });
    }

    async updateStatus(id: string, status: string, userId?: string, reason?: string) {
        if (!['APPROVED', 'REJECTED'].includes(status)) {
            throw new AppError(400, 'Trạng thái yêu cầu đặt sân không hợp lệ');
        }
        await this.expireUnpaidBankTransferRequests();
        if (status === 'APPROVED') {
            const request = await prisma.bookingRequest.findUnique({ where: { id } });
            if (!request) throw new AppError(404, 'Không tìm thấy yêu cầu');
            if (request.status === 'APPROVED') return request;
            if (request.status === 'EXPIRED') throw new AppError(409, 'Yêu cầu đặt sân đã hết hạn thanh toán');
            const courtId = request.courtId;
            if (!courtId) throw new AppError(400, 'Yêu cầu không còn gắn với sân hợp lệ');

            // 1. Find or create Customer
            let customer = request.customerId
                ? await prisma.customer.findUnique({ where: { id: request.customerId } })
                : await prisma.customer.findUnique({ where: { phone: request.phone } });
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
            const amountReceived = this.getReceivedAmount(request);
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
                select: { id: true },
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
                    discountAmount: requestOrder.discountAmount,
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

            const existingInvoiceItem = await prisma.invoiceItem.findFirst({
                where: { bookingId: booking.id },
            });
            if (!existingInvoiceItem) {
                const isPaid = amountReceived >= requestedTotal;
                await invoiceService.create({
                    customerId: customer.id,
                    bookingIds: [booking.id],
                    paymentMethod: request.paymentMethod,
                    paymentStatus: isPaid ? 'PAID' : amountReceived > 0 ? 'PARTIAL' : 'PENDING',
                    paidAmount: amountReceived,
                    notes: `Thanh toán ${request.paymentMethod}${request.voucherCode ? ` (Voucher: ${request.voucherCode})` : ''}`,
                });
            }
        }

        const existingReq = await prisma.bookingRequest.findUnique({ where: { id } });
        let updatedNotes = existingReq?.notes || '';
        if (reason) {
            const reasonTag = `[Lý do: ${reason}]`;
            updatedNotes = updatedNotes ? `${reasonTag} ${updatedNotes}` : reasonTag;
        }

        const updatedRequest = await prisma.$transaction(async (tx) => {
            const updatedRequest = await tx.bookingRequest.update({
                where: { id },
                data: {
                    status,
                    notes: updatedNotes || undefined,
                },
            });
            if (status === 'APPROVED') {
                await redeemBookingPoints(tx, updatedRequest);
            } else if (status === 'REJECTED' || status === 'CANCELLED') {
                await releaseBookingPointReservation(tx, updatedRequest);
            }
            return updatedRequest;
        });
        if (updatedRequest.status === 'APPROVED' || updatedRequest.status === 'REJECTED') {
            await safelyQueueNotification(notificationService.bookingDecision(updatedRequest), 'quyết định đặt sân');
        }
        if (updatedRequest.status === 'APPROVED') {
            const marker = `[Online Request:${updatedRequest.id}]`;
            const booking = await prisma.booking.findFirst({
                where: { notes: { contains: marker } },
                include: { court: { select: { name: true, venueId: true } } },
            });
            if (booking) await safelyQueueNotification(notificationService.upcomingBooking(booking), 'nhắc lịch');
        }
        return updatedRequest;
    }

    async delete(id: string) {
        return prisma.$transaction(async (tx) => {
            const request = await tx.bookingRequest.findUnique({ where: { id } });
            if (!request) throw new AppError(404, 'Không tìm thấy yêu cầu đặt sân');
            if (request.paymentStatus === 'PAID') {
                throw new AppError(400, 'Không thể xóa yêu cầu đã thanh toán; hãy xử lý hoàn tiền và hủy lịch trước');
            }
            await releaseBookingPointReservation(tx, request);
            return tx.bookingRequest.delete({ where: { id } });
        });
    }
}

export const bookingRequestService = new BookingRequestService();
