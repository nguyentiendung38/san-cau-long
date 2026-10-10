import { Router, Request, Response, NextFunction } from 'express';
import { venueService } from '../services/venue.service.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Get all venues (paginated) - PUBLIC
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { search, isActive, page, limit } = req.query;

        const result = await venueService.findAll({
            search: search as string,
            isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
        });

        res.json({
            success: true,
            ...result,
        });
    } catch (error) {
        next(error);
    }
});

// Get venue by ID - PUBLIC
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const venue = await venueService.findById(req.params.id);
        res.json({
            success: true,
            data: venue,
        });
    } catch (error) {
        next(error);
    }
});

// Get venue availability by date - PUBLIC
router.get('/:id/availability', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { date } = req.query;
        const targetDate = date ? new Date(date as string) : new Date();
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();

        const courts = await prisma.court.findMany({
            where: { venueId: req.params.id, status: { not: 'INACTIVE' } },
            orderBy: { sortOrder: 'asc' }
        });

        const bookings = await prisma.booking.findMany({
            where: {
                courtId: { in: courts.map((c: any) => c.id) },
                date: { gte: startOfDay, lte: endOfDay },
                status: { not: 'CANCELLED' }
            }
        });

        const fifteenMinsAgo = new Date(Date.now() - 15 * 60000);
        const pendingRequests = await prisma.bookingRequest.findMany({
            where: {
                courtId: { in: courts.map((c: any) => c.id) },
                date: { gte: startOfDay, lte: endOfDay },
                status: 'PENDING',
                OR: [
                    { paymentMethod: { not: 'VNPAY' } },
                    { createdAt: { gte: fifteenMinsAgo } }
                ]
            }
        });

        const allBlockedSlots = [...bookings, ...pendingRequests];

        res.json({
            success: true,
            data: { courts, bookings: allBlockedSlots }
        });
    } catch (error) {
        next(error);
    }
});

// Get venue stats
router.get('/:id/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await venueService.getStats(req.params.id);
        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
});

// Create venue (Admin/Manager only)
router.post(
    '/',
    authenticate,
    authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const venue = await venueService.create(req.body);
            res.status(201).json({
                success: true,
                message: 'Táº¡o cÆ¡ sá»Ÿ thĂ nh cĂ´ng',
                data: venue,
            });
        } catch (error) {
            next(error);
        }
    }
);

// Update venue (Admin/Manager only)
router.put(
    '/:id',
    authenticate,
    authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const venue = await venueService.update(req.params.id, req.body);
            res.json({
                success: true,
                message: 'Cáº­p nháº­t cÆ¡ sá»Ÿ thĂ nh cĂ´ng',
                data: venue,
            });
        } catch (error) {
            next(error);
        }
    }
);

// Delete venue (Admin only)
router.delete(
    '/:id',
    authenticate,
    authorize('SUPER_ADMIN', 'ADMIN'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await venueService.delete(req.params.id);
            res.json({
                success: true,
                ...result,
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;

