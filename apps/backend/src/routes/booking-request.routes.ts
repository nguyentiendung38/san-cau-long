import { Router, Request, Response, NextFunction } from 'express';
import { bookingRequestService } from '../services/booking-request.service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { authenticatePortalCustomer } from '../middleware/portal-customer-auth.js';

const router = Router();

// Portal customer: Create a request for the authenticated account.
router.post('/public', authenticatePortalCustomer, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const request = await bookingRequestService.create({
            ...req.body,
            customerId: req.portalCustomer!.id,
        });
        res.status(201).json({
            success: true,
            message: 'Đã gửi yêu cầu đặt sân thành công',
            data: request,
        });
    } catch (error) {
        next(error);
    }
});

// Customer: Return only requests belonging to the authenticated portal account.
router.get('/public/my-requests', authenticatePortalCustomer, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const requests = await bookingRequestService.getByCustomerId(req.portalCustomer!.id);
        res.json({
            success: true,
            data: requests,
        });
    } catch (error) {
        next(error);
    }
});

// Customer: Request cancellation; the booking is cancelled only after admin approval.
router.post('/public/:id/cancel-request', authenticatePortalCustomer, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
        if (!reason || reason.length > 500) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do hủy (tối đa 500 ký tự)' });
        }
        const request = await bookingRequestService.requestCancellation(
            req.params.id,
            req.portalCustomer!.id,
            reason,
        );
        res.json({
            success: true,
            message: 'Đã gửi yêu cầu hủy, vui lòng chờ cơ sở xác nhận',
            data: request,
        });
    } catch (error) {
        next(error);
    }
});

router.post('/public/:id/reschedule-request', authenticatePortalCustomer, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
        const date = new Date(req.body.date);
        const startTime = req.body.startTime;
        const endTime = req.body.endTime;
        if (!reason || reason.length > 500 || Number.isNaN(date.getTime()) ||
            typeof startTime !== 'string' || typeof endTime !== 'string') {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn ngày, khung giờ mới và nhập lý do (tối đa 500 ký tự)' });
        }
        const request = await bookingRequestService.requestCancellation(
            req.params.id,
            req.portalCustomer!.id,
            reason,
            { type: 'RESCHEDULE', date, startTime, endTime },
        );
        res.json({ success: true, message: 'Đã gửi yêu cầu đổi lịch, vui lòng chờ cơ sở xác nhận', data: request });
    } catch (error) {
        next(error);
    }
});

// Admin: Review a customer's cancellation request.
router.put('/:id/cancellation-review', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { status, reason } = req.body;
        if (status !== 'APPROVED' && status !== 'REJECTED') {
            return res.status(400).json({ success: false, message: 'Trạng thái xử lý yêu cầu hủy không hợp lệ' });
        }
        if (reason !== undefined && (typeof reason !== 'string' || reason.length > 500)) {
            return res.status(400).json({ success: false, message: 'Lý do xử lý tối đa 500 ký tự' });
        }
        const request = await bookingRequestService.reviewCancellationRequest(req.params.id, status, reason);
        res.json({
            success: true,
            message: status === 'APPROVED' ? 'Đã duyệt hủy lịch' : 'Đã từ chối yêu cầu hủy',
            data: request,
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
        const { status, reason } = req.body;
        const request = await bookingRequestService.updateStatus(req.params.id, status, (req as any).user?.id, reason);
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
