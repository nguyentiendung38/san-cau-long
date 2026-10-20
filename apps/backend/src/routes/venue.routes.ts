import { Router, Request, Response, NextFunction } from 'express';
import { venueService } from '../services/venue.service.js';
import { authenticate, authorize } from '../middleware/auth.js';
import prisma from '../config/database.js';
import { bookingRequestService } from '../services/booking-request.service.js';

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
        const startOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()));
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60_000 - 1);
        await bookingRequestService.expireUnpaidBankTransferRequests();

        const courts = await prisma.court.findMany({
            where: { venueId: req.params.id, status: 'ACTIVE', venue: { isActive: true } },
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
        const now = new Date();
        const pendingRequests = await prisma.bookingRequest.findMany({
            where: {
                courtId: { in: courts.map((c: any) => c.id) },
                date: { gte: startOfDay, lte: endOfDay },
                status: 'PENDING',
                paymentStatus: { not: 'FAILED' },
                OR: [
                    { paymentMethod: 'DEPOSIT_TRANSFER', expiresAt: { gt: now } },
                    { paymentMethod: 'VNPAY', createdAt: { gte: fifteenMinsAgo } },
                    { paymentMethod: { notIn: ['DEPOSIT_TRANSFER', 'VNPAY'] } },
                ],
            }
        });

        const closures = await prisma.maintenanceClosure.findMany({
            where: {
                courtId: { in: courts.map((court: any) => court.id) },
                startAt: { lt: new Date(startOfDay.getTime() + 24 * 60 * 60_000) },
                endAt: { gt: startOfDay },
            },
        });
        const closureSlots = closures.map((closure) => {
            const clippedStart = closure.startAt > startOfDay ? closure.startAt : startOfDay;
            const clippedEnd = closure.endAt < new Date(startOfDay.getTime() + 24 * 60 * 60_000)
                ? closure.endAt
                : new Date(startOfDay.getTime() + 24 * 60 * 60_000);
            const toTime = (date: Date) => `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
            return {
                id: `maintenance-${closure.id}`,
                courtId: closure.courtId,
                date: startOfDay,
                startTime: toTime(clippedStart),
                endTime: toTime(clippedEnd),
                status: closure.closureType === 'TOURNAMENT' ? 'TOURNAMENT' : 'MAINTENANCE',
                notes: closure.reason || (closure.closureType === 'TOURNAMENT' ? 'Tổ chức giải' : 'Bảo trì'),
            };
        });
        const allBlockedSlots = [...bookings, ...pendingRequests, ...closureSlots];

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
