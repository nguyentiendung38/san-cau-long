import { Router, Request, Response, NextFunction } from 'express';
import * as crypto from 'node:crypto';
import * as https from 'node:https';
import prisma from '../config/database.js';
import { BookingRequestService } from '../services/booking-request.service.js';

const router = Router();
const bookingRequestService = new BookingRequestService();

const accessKey = process.env.MOMO_ACCESS_KEY || 'F8BBA842ECF85';
const secretKey = process.env.MOMO_SECRET_KEY || 'K951B6PE1waDMi640xX08PD3vg6EkVlz';
const partnerCode = process.env.MOMO_PARTNER_CODE || 'MOMO';
// Thay đổi redirectUrl trỏ về backend để browser kích hoạt callback cập nhật trạng thái (do MoMo server ko gọi được localhost IPN)
const redirectUrl = process.env.MOMO_REDIRECT_URL || 'http://localhost:3000/api/momo/callback';
const ipnUrl = process.env.MOMO_IPN_URL || 'http://localhost:3000/api/momo/callback';
const momoApiHost = process.env.MOMO_API_HOST || 'test-payment.momo.vn';
const momoApiPath = process.env.MOMO_API_PATH || '/v2/gateway/api/create';
const requestType = process.env.MOMO_REQUEST_TYPE || 'captureWallet';

router.post('/create-payment', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { amount, orderId, requestType: reqTypeFromBody } = req.body;
        const safeOrderId = String(orderId || '').trim();
        
        if (!safeOrderId) {
            return res.status(400).json({ success: false, message: 'Thiếu orderId' });
        }

        const booking = await prisma.bookingRequest.findUnique({ where: { id: safeOrderId } });
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu đặt sân' });
        }

        const realAmount = Number(booking.paymentAmount);
        const safeAmount = realAmount > 0 ? realAmount : (Number(amount) || 0);

        // 'payWithMethod' cho phép MoMo hiển thị tất cả phương thức: QR, ATM, Credit Card
        // 'captureWallet' chỉ hiện QR MoMo Wallet
        const activeRequestType = reqTypeFromBody || 'payWithMethod';

        if (safeAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Amount không hợp lệ' });
        }

        const requestId = `${partnerCode}${Date.now()}`;
        const orderInfo = `Thanh toan don hang ${safeOrderId}`;
        const extraData = '';

        const rawSignature = `accessKey=${accessKey}&amount=${safeAmount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${safeOrderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${activeRequestType}`;

        const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

        const requestBody = JSON.stringify({
            partnerCode,
            partnerName: 'Test',
            storeId: 'MomoTestStore',
            requestId,
            amount: safeAmount,
            orderId: safeOrderId,
            orderInfo,
            redirectUrl,
            ipnUrl,
            lang: 'vi',
            requestType: activeRequestType,
            autoCapture: true,
            extraData,
            orderGroupId: '',
            signature,
        });

        const options = {
            hostname: momoApiHost,
            port: 443,
            path: momoApiPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody),
            },
        };

        const reqMoMo = https.request(options, (resMoMo) => {
            let data = '';
            resMoMo.on('data', (chunk) => { data += chunk; });
            resMoMo.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (!response || !response.payUrl) {
                        return res.status(400).json({
                            success: false,
                            message: 'Không nhận được payUrl từ MoMo test',
                            details: response,
                        });
                    }

                    return res.json({ success: true, payUrl: response.payUrl });
                } catch (error) {
                    next(error);
                }
            });
        });

        reqMoMo.on('error', (e) => next(e));
        reqMoMo.write(requestBody);
        reqMoMo.end();
    } catch (error) {
        next(error);
    }
});

router.get('/callback', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { resultCode, orderId: queryOrderId } = req.query;
        if (resultCode !== '0') {
            return res.redirect('http://localhost:5173/co-so?payment=failed&tab=history');
        }
        
        const orderId = queryOrderId as string;
        
        if (orderId) {
            try {
                await bookingRequestService.updatePaymentStatus(orderId, 'PAID');
                await bookingRequestService.updateStatus(orderId, 'APPROVED');
            } catch (err) {
                console.error('Lỗi cập nhật trạng thái khi thanh toán:', err);
            }
        }
        
        return res.redirect('http://localhost:5173/co-so?payment=success&tab=history');
    } catch (error) {
        next(error);
    }
});

export default router;