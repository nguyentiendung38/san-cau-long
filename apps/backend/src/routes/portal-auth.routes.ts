import { Router } from 'express';
import { portalAuthService } from '../services/portal-auth.service.js';
import { z } from 'zod';
import { authenticatePortalCustomer } from '../middleware/portal-customer-auth.js';
import { customerFavoritesService } from '../services/customer-favorites.service.js';

const router = Router();

const requestOtpSchema = z.object({
    phone: z.string().trim().min(9).max(15),
    password: z.string().min(8),
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().transform((email) => email.toLowerCase())
});

const verifyOtpSchema = z.object({
    phone: z.string().trim().min(9).max(15),
    password: z.string().min(8),
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().transform((email) => email.toLowerCase()),
    otp: z.string().length(6)
});

const loginSchema = z.object({
    identifier: z.string(),
    password: z.string()
});



router.post('/request-hue-otp', authenticatePortalCustomer, async (req, res, next) => {
    try {
        const { studentId, faculty, email } = req.body;
        const result = await portalAuthService.requestHueOtp(req.portalCustomer!.id, { studentId, faculty, email });
        res.json({
            success: true,
            ...result,
        });
    } catch (err) {
        next(err);
    }
});

router.post('/verify-hue-otp', authenticatePortalCustomer, async (req, res, next) => {
    try {
        const { studentId, faculty, email, otp, customerType } = req.body;
        const customer = await portalAuthService.verifyHueOtp(req.portalCustomer!.id, { studentId, faculty, email, otp, customerType });
        res.json({
            success: true,
            message: 'Xác thực Sinh viên Trường Đại học Kinh tế Huế thành công! Đã kích hoạt ưu đãi -20% tiền sân.',
            data: customer,
        });
    } catch (err) {
        next(err);
    }
});

router.post('/verify-hue', authenticatePortalCustomer, async (req, res, next) => {
    try {
        const { studentId, faculty, customerType } = req.body;
        const customer = await portalAuthService.verifyHue(req.portalCustomer!.id, { studentId, faculty, customerType });
        res.json({
            success: true,
            message: 'Xác thực Sinh viên/Cán bộ Trường Đại học Kinh tế Huế thành công! Đã kích hoạt ưu đãi -20% tiền sân.',
            data: customer,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/me', authenticatePortalCustomer, async (req, res, next) => {
    try {
        const customer = await portalAuthService.getCustomerLoyalty(req.portalCustomer!.id);
        res.json({ success: true, data: customer });
    } catch (err) {
        next(err);
    }
});

router.get('/favorites', authenticatePortalCustomer, async (req, res, next) => {
    try {
        res.json({ success: true, data: await customerFavoritesService.get(req.portalCustomer!.id) });
    } catch (err) {
        next(err);
    }
});

router.put('/favorites/venues/:venueId', authenticatePortalCustomer, async (req, res, next) => {
    try {
        if (typeof req.body.favorite !== 'boolean') {
            return res.status(400).json({ success: false, message: 'Trạng thái yêu thích không hợp lệ' });
        }
        const data = await customerFavoritesService.setVenue(
            req.portalCustomer!.id,
            req.params.venueId,
            req.body.favorite,
        );
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
});

router.put('/favorites/courts/:courtId', authenticatePortalCustomer, async (req, res, next) => {
    try {
        if (typeof req.body.favorite !== 'boolean') {
            return res.status(400).json({ success: false, message: 'Trạng thái yêu thích không hợp lệ' });
        }
        const data = await customerFavoritesService.setCourt(
            req.portalCustomer!.id,
            req.params.courtId,
            req.body.favorite,
        );
        res.json({ success: true, data });
    } catch (err) {
        next(err);
    }
});

router.post('/register-otp', async (req, res, next) => {
    try {
        const data = requestOtpSchema.parse(req.body);
        const result = await portalAuthService.requestOtp(data);
        res.status(200).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

router.post('/verify-register', async (req, res, next) => {
    try {
        const data = verifyOtpSchema.parse(req.body);
        const result = await portalAuthService.verifyAndRegister(data);
        res.status(201).json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

router.post('/login', async (req, res, next) => {
    try {
        const data = loginSchema.parse(req.body);
        const result = await portalAuthService.login(data);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

router.post('/forgot-password-otp', async (req, res, next) => {
    try {
        const schema = z.object({ email: z.string().trim().email().transform((email) => email.toLowerCase()) });
        const data = schema.parse(req.body);
        const result = await portalAuthService.requestResetPasswordOtp(data);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

router.post('/reset-password', async (req, res, next) => {
    try {
        const schema = z.object({ 
            email: z.string().email(),
            otp: z.string().length(6),
            newPassword: z.string().min(8)
        });
        const data = schema.parse(req.body);
        const result = await portalAuthService.resetPassword(data);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err);
    }
});

export default router;
