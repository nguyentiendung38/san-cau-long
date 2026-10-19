import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { venueReviewService } from '../services/venue-review.service.js';
import { authenticatePortalCustomer } from '../middleware/portal-customer-auth.js';

const router = Router();

const createReviewSchema = z.object({
    bookingId: z.string().min(1),
    rating: z.number().int().min(1).max(5),
    content: z.string().trim().min(1).max(2000),
    images: z.array(z.string().max(1_500_000).regex(/^data:image\/(?:jpeg|png|webp);base64,/)).max(5).optional(),
});

const statusSchema = z.object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
});

router.get('/public/eligible', authenticatePortalCustomer, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const bookings = await venueReviewService.findEligibleBookings(req.portalCustomer!.id);
        res.json({ success: true, data: bookings });
    } catch (error) {
        next(error);
    }
});

router.get('/public/:venueId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const reviews = await venueReviewService.findPublic(req.params.venueId);
        res.json({ success: true, data: reviews });
    } catch (error) {
        next(error);
    }
});

router.get('/public-summary', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const venueIds = typeof req.query.venueIds === 'string'
            ? req.query.venueIds.split(',').filter(Boolean).slice(0, 100)
            : [];
        const summaries = await venueReviewService.findPublicSummaries(venueIds);
        res.json({ success: true, data: summaries });
    } catch (error) {
        next(error);
    }
});

router.post('/public', authenticatePortalCustomer, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const validated = createReviewSchema.parse(req.body);
        const review = await venueReviewService.create({ ...validated, customerId: req.portalCustomer!.id });
        res.status(201).json({
            success: true,
            message: 'Đánh giá đã được gửi và đang chờ admin duyệt',
            data: review,
        });
    } catch (error) {
        next(error);
    }
});

router.get(
    '/',
    authenticate,
    authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
    async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const reviews = await venueReviewService.findAll();
            res.json({ success: true, data: reviews });
        } catch (error) {
            next(error);
        }
    },
);

router.patch(
    '/:id/status',
    authenticate,
    authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { status } = statusSchema.parse(req.body);
            const review = await venueReviewService.updateStatus(req.params.id, status);
            res.json({ success: true, data: review });
        } catch (error) {
            next(error);
        }
    },
);

export default router;
