import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { pricingRuleService } from '../services/pricing-rule.service.js';

const router = Router();

const pricingRuleSchema = z.object({
    venueId: z.string().min(1, 'Vui lòng chọn cơ sở'),
    name: z.string().min(1, 'Vui lòng nhập tên khung giá'),
    description: z.string().optional().nullable(),
    dayOfWeek: z.string().optional().nullable(),
    startTime: z.string().optional().nullable(),
    endTime: z.string().optional().nullable(),
    pricePerHour: z.number().min(0, 'Giá phải >= 0'),
    priority: z.number().int().optional(),
    isActive: z.boolean().optional(),
});

const updatePricingRuleSchema = z.object({
    name: z.string().min(1, 'Vui lòng nhập tên khung giá').optional(),
    description: z.string().optional().nullable(),
    dayOfWeek: z.string().optional().nullable(),
    startTime: z.string().optional().nullable(),
    endTime: z.string().optional().nullable(),
    pricePerHour: z.number().min(0, 'Giá phải >= 0').optional(),
    priority: z.number().int().optional(),
    isActive: z.boolean().optional(),
});

router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { venueId, isActive, search, page, limit } = req.query;
        const result = await pricingRuleService.findAll({
            venueId: venueId as string,
            isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
            search: search as string,
            page: page ? parseInt(page as string) : 1,
            limit: limit ? parseInt(limit as string) : 20,
        });
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const rule = await pricingRuleService.findById(req.params.id);
        res.json({ success: true, data: rule });
    } catch (error) {
        next(error);
    }
});

router.post('/', authenticate, authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const validated = pricingRuleSchema.parse(req.body);
        const rule = await pricingRuleService.create(validated);
        res.status(201).json({ success: true, data: rule });
    } catch (error) {
        next(error);
    }
});

router.put('/:id', authenticate, authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const validated = updatePricingRuleSchema.parse(req.body);
        const rule = await pricingRuleService.update(req.params.id, validated);
        res.json({ success: true, data: rule });
    } catch (error) {
        next(error);
    }
});

router.delete('/:id', authenticate, authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        await pricingRuleService.delete(req.params.id);
        res.json({ success: true, message: 'Đã xóa khung giá' });
    } catch (error) {
        next(error);
    }
});

export default router;
