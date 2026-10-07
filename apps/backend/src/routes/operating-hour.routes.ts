import { Router } from 'express';
import { operatingHourService } from '../services/operating-hour.service.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';

const router = Router();

// Lấy danh sách khung giờ
router.get('/', async (req, res, next) => {
    try {
        const { venueId, isActive } = req.query;
        const result = await operatingHourService.getAll({
            venueId: venueId as string,
            isActive: isActive ? isActive === 'true' : undefined,
        });
        res.json({
            status: 'success',
            ...result,
        });
    } catch (error) {
        next(error);
    }
});

// Lấy chi tiết khung giờ
router.get('/:id', async (req, res, next) => {
    try {
        const item = await operatingHourService.getById(req.params.id);
        res.json({
            status: 'success',
            data: item,
        });
    } catch (error) {
        next(error);
    }
});

// Thêm khung giờ mới (Yêu cầu đăng nhập)
router.post('/', authenticate, async (req, res, next) => {
    try {
        const item = await operatingHourService.create(req.body);
        res.status(201).json({
            status: 'success',
            data: item,
        });
    } catch (error) {
        next(error);
    }
});

// Cập nhật khung giờ (Yêu cầu đăng nhập)
router.put('/:id', authenticate, async (req, res, next) => {
    try {
        const item = await operatingHourService.update(req.params.id, req.body);
        res.json({
            status: 'success',
            data: item,
        });
    } catch (error) {
        next(error);
    }
});

// Xóa khung giờ (Yêu cầu đăng nhập)
router.delete('/:id', authenticate, async (req, res, next) => {
    try {
        const result = await operatingHourService.delete(req.params.id);
        res.json({
            status: 'success',
            ...result,
        });
    } catch (error) {
        next(error);
    }
});

export default router;
