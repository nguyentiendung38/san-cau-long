import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { bookingRequestService } from '../services/booking-request.service.js';
import { VNPay, ignoreLogger } from 'vnpay';
import { format } from 'date-fns';

const router = Router();
const prisma = new PrismaClient();

const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

const tmnCode = process.env.VNPAY_TMN_CODE?.trim();
const secureSecret = process.env.VNPAY_HASH_SECRET?.trim();
const vnpay = tmnCode && secureSecret ? new VNPay({
    tmnCode,
    secureSecret,
    vnpayHost: 'https://sandbox.vnpayment.vn',
    testMode: true, 
    hashAlgorithm: 'SHA512' as any, 
    enableLog: false, 
    loggerFn: ignoreLogger, 
}) : null;

router.post('/create-payment', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { orderId, bankCode, source } = req.body;
        
        if (!vnpay) {
            return res.status(503).json({
                success: false,
                message: 'Chưa cấu hình VNPAY_TMN_CODE và VNPAY_HASH_SECRET của tài khoản Sandbox.',
            });
        }

        if (!orderId) {
            return res.status(400).json({ success: false, message: 'Thiếu orderId' });
        }

        const booking = await prisma.bookingRequest.findUnique({ where: { id: orderId } });
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu đặt sân' });
        }
        if (booking.paymentMethod !== 'VNPAY' || booking.paymentStatus === 'PAID' || !['PENDING', 'APPROVED'].includes(booking.status)) {
            return res.status(409).json({ success: false, message: 'Yêu cầu không còn ở trạng thái chờ thanh toán VNPay' });
        }

        let orderSnapshot: { totalAmount?: number; paidAmount?: number } = {};
        try {
            orderSnapshot = booking.orderedItems ? JSON.parse(booking.orderedItems) : {};
        } catch {
            return res.status(400).json({ success: false, message: 'Chi tiết thanh toán không hợp lệ' });
        }
        const totalAmount = Number(orderSnapshot.totalAmount ?? booking.paymentAmount);
        const paidAmount = Number(orderSnapshot.paidAmount ?? (booking.paymentStatus === 'PAID' ? booking.paymentAmount : 0));
        const safeAmount = Math.max(0, totalAmount - paidAmount);

        if (safeAmount <= 0) {
            return res.status(409).json({ success: false, message: 'Yêu cầu này không còn khoản tiền cần thanh toán' });
        }

        const configuredReturnUrl = process.env.VNPAY_RETURN_URL?.trim();
        let returnUrl: URL;
        try {
            if (!configuredReturnUrl) throw new Error('missing');
            returnUrl = new URL(configuredReturnUrl);
        } catch {
            return res.status(503).json({
                success: false,
                message: 'VNPAY_RETURN_URL phải là callback đã đăng ký với VNPay Sandbox.',
            });
        }
        returnUrl.pathname = returnUrl.pathname.replace(/\/+$/, '');
        if (!returnUrl.pathname.endsWith('/callback')) {
            return res.status(503).json({
                success: false,
                message: 'VNPAY_RETURN_URL phải trỏ đến endpoint VNPay /callback.',
            });
        }
        if (source === 'zalo') {
            returnUrl.searchParams.set('source', 'zalo');
        }
        
        const ipAddr = '127.0.0.1';
        
        const createDateStr = format(new Date(), 'yyyyMMddHHmmss');

        const urlString = vnpay.buildPaymentUrl({
            vnp_Amount: safeAmount,
            vnp_IpAddr: ipAddr,
            vnp_TxnRef: orderId + '-' + Date.now(),
            vnp_OrderInfo: 'Payment_for_order_' + orderId, 
            vnp_OrderType: 'other' as any,
            vnp_ReturnUrl: returnUrl.toString(),
            vnp_Locale: 'vn' as any,
            vnp_CreateDate: Number(createDateStr),
            ...(bankCode ? { vnp_BankCode: bankCode } : {})
        });
        
        return res.json({ success: true, payUrl: urlString });
    } catch (error) {
        next(error);
    }
});

const successHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Thanh toán thành công</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f3f4f6; }
        .box { background: white; padding: 32px; border-radius: 16px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 90%; width: 320px; }
        .icon { color: #10b981; font-size: 64px; line-height: 1; margin-bottom: 16px; }
        .title { font-size: 20px; font-weight: bold; margin-bottom: 8px; color: #111827; }
        .desc { color: #6b7280; margin-bottom: 24px; font-size: 15px; }
        .btn { background: #006af5; color: white; border: none; padding: 14px 24px; border-radius: 8px; font-size: 16px; cursor: pointer; width: 100%; font-weight: 500; display: block; text-decoration: none; }
    </style>
</head>
<body>
    <div class="box">
        <div class="icon">✓</div>
        <div class="title">Thanh toán thành công!</div>
        <div class="desc">Cảm ơn bạn. Đơn đặt sân đã được xác nhận.</div>
        <button class="btn" id="closeBtn">Đóng & Quay lại</button>
    </div>
    <script>
        setTimeout(() => { window.close(); }, 3000);
        document.getElementById('closeBtn').addEventListener('click', () => { window.close(); });
    </script>
</body>
</html>
`;

const failedHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Thanh toán thất bại</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f3f4f6; }
        .box { background: white; padding: 32px; border-radius: 16px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 90%; width: 320px; }
        .icon { color: #ef4444; font-size: 64px; line-height: 1; margin-bottom: 16px; }
        .title { font-size: 20px; font-weight: bold; margin-bottom: 8px; color: #111827; }
        .desc { color: #6b7280; margin-bottom: 24px; font-size: 15px; }
        .btn { background: #006af5; color: white; border: none; padding: 14px 24px; border-radius: 8px; font-size: 16px; cursor: pointer; width: 100%; font-weight: 500; display: block; text-decoration: none; }
    </style>
</head>
<body>
    <div class="box">
        <div class="icon">✗</div>
        <div class="title">Thanh toán thất bại!</div>
        <div class="desc">Giao dịch không thành công hoặc đã bị hủy.</div>
        <button class="btn" id="closeBtn">Đóng & Quay lại</button>
    </div>
<script>
        document.getElementById('closeBtn').addEventListener('click', () => { window.close(); });
    </script>
</body>
</html>
`;

router.get(['/callback', '/callback/:source'], async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!vnpay) {
            return res.status(503).send('VNPay callback chưa được cấu hình.');
        }
        const source = req.params.source || req.query.source;
        // Chỉ truyền các tham số vnp_* vào verifyReturnUrl để đảm bảo tính đúng checksum SHA512
        const vnpParams: Record<string, any> = {};
        for (const [key, val] of Object.entries(req.query)) {
            if (key.startsWith('vnp_')) {
                vnpParams[key] = val;
            }
        }
        const verify = vnpay.verifyReturnUrl(vnpParams as any);
        const transactionReference = typeof req.query.vnp_TxnRef === 'string' ? req.query.vnp_TxnRef : '';
        const orderId = verify.vnp_TxnRef ? verify.vnp_TxnRef.split('-')[0] : '';
        const booking = orderId ? await prisma.bookingRequest.findUnique({ where: { id: orderId } }) : null;
        let expectedPaymentAmount = -1;
        let totalAmount = 0;
        if (booking) {
            try {
                const orderSnapshot = booking.orderedItems ? JSON.parse(booking.orderedItems) : {};
                totalAmount = Number(orderSnapshot.totalAmount ?? booking.paymentAmount);
                const paidAmount = Number(orderSnapshot.paidAmount ?? (booking.paymentStatus === 'PAID' ? booking.paymentAmount : 0));
                expectedPaymentAmount = Math.round(Math.max(0, totalAmount - paidAmount) * 100);
            } catch {
                expectedPaymentAmount = -1;
            }
        }
        const reportedAmount = Number(req.query.vnp_Amount);
        const validPayment = verify.isVerified &&
            verify.isSuccess &&
            !!booking &&
            booking.paymentMethod === 'VNPAY' &&
            ['PENDING', 'APPROVED'].includes(booking.status) &&
            booking.paymentStatus !== 'PAID' &&
            transactionReference.startsWith(`${booking.id}-`) &&
            Number.isFinite(reportedAmount) &&
            reportedAmount === expectedPaymentAmount &&
            expectedPaymentAmount > 0;

        if (validPayment && booking) {
            await bookingRequestService.updatePaymentStatus(booking.id, 'PAID', totalAmount);
            if (booking.status === 'PENDING') {
                await bookingRequestService.updateStatus(booking.id, 'APPROVED');
            }
            if (source === 'zalo') {
                res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-hashes'; style-src 'self' 'unsafe-inline';");
                return res.send(successHtml);
            } else {
                return res.redirect(`${frontendUrl}/trang-chu?payment=success&tab=history`);
            }
        } else {
            if (
                verify.isVerified &&
                booking?.paymentMethod === 'VNPAY' &&
                ['PENDING', 'APPROVED'].includes(booking.status) &&
                booking.paymentStatus !== 'PAID'
            ) {
                await bookingRequestService.updatePaymentStatus(booking.id, 'FAILED');
            }
            if (source === 'zalo') {
                res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-hashes'; style-src 'self' 'unsafe-inline';");
                return res.send(failedHtml);
            } else {
                return res.redirect(`${frontendUrl}/trang-chu?payment=failed&tab=history`);
            }
        }
    } catch (error) {
        next(error);
    }
});

export default router;
