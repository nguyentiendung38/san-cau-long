import { Router, Request, Response, NextFunction } from 'express';
import { bookingRequestService } from '../services/booking-request.service.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Public: Create a booking request
router.post('/public', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const request = await bookingRequestService.create(req.body);
        res.status(201).json({
            success: true,
            message: 'Đã gửi yêu cầu đặt sân thành công',
            data: request,
        });
    } catch (error) {
        next(error);
    }
});

// Public: Get requests by phone
router.get('/public/my-requests', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const phone = req.query.phone as string;
        if (!phone) {
            return res.json({ success: true, data: [] });
        }
        const requests = await bookingRequestService.getByPhone(phone);
        res.json({
            success: true,
            data: requests,
        });
    } catch (error) {
        next(error);
    }
});

// Admin: Get all requests
router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const venueId = req.query.venueId as string;
        const requests = await bookingRequestService.getAll(venueId);
        res.json({
            success: true,
            data: requests,
        });
    } catch (error) {
        next(error);
    }
});

// Admin: Update status
router.put('/:id/status', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const request = await bookingRequestService.updateStatus(req.params.id, req.body.status, (req as any).user?.id);
        res.json({
            success: true,
            message: 'Đã cập nhật trạng thái',
            data: request,
        });
    } catch (error) {
        next(error);
    }
});

// Admin: Delete
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        await bookingRequestService.delete(req.params.id);
        res.json({
            success: true,
            message: 'Đã xóa yêu cầu',
        });
    } catch (error) {
        next(error);
    }
});

// Admin: Update payment status
router.patch('/:id/payment-status', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { paymentStatus, paymentAmount } = req.body;
        const request = await bookingRequestService.updatePaymentStatus(req.params.id, paymentStatus, paymentAmount);
        res.json({
            success: true,
            message: 'Đã cập nhật trạng thái thanh toán',
            data: request,
        });
    } catch (error) {
        next(error);
    }
});

export default router;
