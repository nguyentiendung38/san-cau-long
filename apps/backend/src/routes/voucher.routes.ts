import { Router } from 'express';
import { voucherService } from '../services/voucher.service.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/validate', async (req, res, next) => {
    try {
        const { code, orderValue } = req.body;
        if (!code) return res.status(400).json({ success: false, message: 'Vui lòng nhập mã ưu đãi' });
        const result = await voucherService.validate(code, orderValue || 0);
        res.json({ success: true, data: result });
    } catch (err) { next(err); }
});

router.get('/', authenticate, async (req, res, next) => {
    try {
        const items = await voucherService.getAll();
        res.json({ success: true, data: items });
    } catch (err) { next(err); }
});

router.post('/', authenticate, async (req, res, next) => {
    try {
        const item = await voucherService.create(req.body);
        res.status(201).json({ success: true, data: item });
    } catch (err) { next(err); }
});

router.put('/:id', authenticate, async (req, res, next) => {
    try {
        const item = await voucherService.update(req.params.id, req.body);
        res.json({ success: true, data: item });
    } catch (err) { next(err); }
});

router.delete('/:id', authenticate, async (req, res, next) => {
    try {
        await voucherService.delete(req.params.id);
        res.json({ success: true });
    } catch (err) { next(err); }
});

export default router;
