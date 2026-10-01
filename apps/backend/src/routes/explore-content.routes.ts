import { Router, Request, Response, NextFunction } from 'express';
import { ExploreContentService } from '../services/explore-content.service.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const service = new ExploreContentService();

// Public: Portal lấy nội dung đang active
router.get('/public', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { type } = req.query;
        const items = await service.getAll(type as string | undefined, true);
        res.json({ success: true, data: items });
    } catch (err) { next(err); }
});

// Admin: Lấy tất cả
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { type } = req.query;
        const items = await service.getAll(type as string | undefined);
        res.json({ success: true, data: items });
    } catch (err) { next(err); }
});

// Admin: Tạo mới
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const item = await service.create(req.body);
        res.status(201).json({ success: true, data: item });
    } catch (err) { next(err); }
});

// Admin: Cập nhật
router.put('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const item = await service.update(req.params.id, req.body);
        res.json({ success: true, data: item });
    } catch (err) { next(err); }
});

// Admin: Xóa
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        await service.delete(req.params.id);
        res.json({ success: true, message: 'Đã xóa' });
    } catch (err) { next(err); }
});

export default router;
