import { Router } from 'express';
import { portalAuthService } from '../services/portal-auth.service.js';
import { z } from 'zod';

const router = Router();

const requestOtpSchema = z.object({
    phone: z.string(),
    password: z.string().min(8),
    name: z.string(),
    email: z.string().email()
});

const verifyOtpSchema = z.object({
    phone: z.string(),
    password: z.string().min(8),
    name: z.string(),
    email: z.string().email(),
    otp: z.string().length(6)
});

const loginSchema = z.object({
    identifier: z.string(),
    password: z.string()
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

// Legacy direct register endpoint
router.post('/register', async (req, res, next) => {
    try {
        const data = requestOtpSchema.parse(req.body);
        const result = await portalAuthService.register(data);
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
        const schema = z.object({ email: z.string().email() });
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
