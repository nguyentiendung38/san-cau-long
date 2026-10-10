import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { bookingRequestService } from '../services/booking-request.service.js';
import { VNPay, ignoreLogger } from 'vnpay';
import { format } from 'date-fns';

const router = Router();
const prisma = new PrismaClient();

const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

// Initialize VNPay instance
const vnpay = new VNPay({
    tmnCode: process.env.VNPAY_TMN_CODE?.trim() || 'MX1CF5ZZ',
    secureSecret: process.env.VNPAY_HASH_SECRET?.trim() || 'TDAQRPYXKBCBJJYUVKECLMCABMVGQCBO',
    vnpayHost: 'https://sandbox.vnpayment.vn',
    testMode: true, 
    hashAlgorithm: 'SHA512', 
    enableLog: false, 
    loggerFn: ignoreLogger, 
});

router.post('/create-payment', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { amount, orderId, bankCode, source } = req.body;
        
        if (!orderId) {
            return res.status(400).json({ success: false, message: 'Thiếu orderId' });
        }

        const booking = await prisma.bookingRequest.findUnique({ where: { id: orderId } });
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu đặt sân' });
        }

        const realAmount = Number(booking.paymentAmount);
        const safeAmount = realAmount > 0 ? realAmount : (Number(amount) || 0);

        if (safeAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Amount không hợp lệ' });
        }

        const baseUrl = process.env.VNPAY_RETURN_URL?.trim() || 'http://localhost:3000/api/vnpay/callback';
        const vnp_ReturnUrl = source === 'zalo' ? baseUrl.replace('/callback', '/callback/zalo') : baseUrl;
        
        const ipAddr = '127.0.0.1';
        
        const createDateStr = format(new Date(), 'yyyyMMddHHmmss');

        const urlString = vnpay.buildPaymentUrl({
            vnp_Amount: safeAmount,
            vnp_IpAddr: ipAddr,
            vnp_TxnRef: orderId + '-' + Date.now(),
            vnp_OrderInfo: 'Payment_for_order_' + orderId, 
            vnp_OrderType: 'other',
            vnp_ReturnUrl: vnp_ReturnUrl,
            vnp_Locale: 'vn',
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
        const source = req.params.source || req.query.source;
        const verify = vnpay.verifyReturnUrl(req.query as any);
        const orderId = verify.vnp_TxnRef ? verify.vnp_TxnRef.split('-')[0] : '';

        if (verify.isSuccess) {
            if (orderId) {
                await bookingRequestService.updatePaymentStatus(orderId, 'PAID');
                await bookingRequestService.updateStatus(orderId, 'APPROVED');
            }
            if (source === 'zalo') {
                res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-hashes'; style-src 'self' 'unsafe-inline';");
                return res.send(successHtml);
            } else {
                return res.redirect(`${frontendUrl}/trang-chu?payment=success&tab=history`);
            }
        } else {
            if (orderId) {
                await bookingRequestService.updatePaymentStatus(orderId, 'FAILED');
            }
            if (source === 'zalo') {
                res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-hashes'; style-src 'self' 'unsafe-inline';");
                return res.send(failedHtml);
            } else {
                return res.redirect(`${frontendUrl}/trang-chu?payment=failed&tab=history`);
            }
        }
    } catch (error) {
        return res.redirect(`${frontendUrl}/trang-chu?payment=failed&tab=history`);
    }
});

export default router;
