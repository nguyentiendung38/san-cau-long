import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authService } from '../services/auth.service.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const otpRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Quá nhiều yêu cầu mã OTP, vui lòng thử lại sau' },
});
const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Quá nhiều yêu cầu đăng ký, vui lòng thử lại sau' },
});
const otpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Quá nhiều lần nhập mã OTP, vui lòng thử lại sau' },
});
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Quá nhiều lần đăng nhập, vui lòng thử lại sau' },
});

const newPasswordSchema = z.string()
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
    .max(72)
    .refine((password) => Buffer.byteLength(password, 'utf8') <= 72, 'Mật khẩu không được vượt quá 72 byte');

// Validation schemas
const loginSchema = z.object({
    email: z.string().trim().email('Email không hợp lệ'),
    password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
});

const registerSchema = z.object({
    email: z.string().trim().email('Email không hợp lệ').transform((email) => email.toLowerCase()),
    password: newPasswordSchema,
    name: z.string().trim().min(2, 'Tên phải có ít nhất 2 ký tự').max(100),
    phone: z.string().trim().max(20).optional(),
});

const otpSchema = z.object({
    email: z.string().trim().email('Email không hợp lệ').transform((email) => email.toLowerCase()),
    otp: z.string().regex(/^\d{6}$/, 'Mã OTP phải gồm 6 chữ số'),
});

const resetPasswordSchema = otpSchema.extend({
    newPassword: newPasswordSchema,
});

const refreshSchema = z.object({
    refreshToken: z.string(),
});

// Routes
router.post('/login', loginLimiter, async (req, res, next) => {
    try {
        const data = loginSchema.parse(req.body);
        const result = await authService.login(data);

        res.json({
            success: true,
            message: 'Đăng nhập thành công',
            data: result,
        });
    } catch (error) {
        next(error);
    }
});

router.post('/register', registerLimiter, async (req, res, next) => {
    try {
        const data = registerSchema.parse(req.body);
        const result = await authService.register(data);
        res.status(201).json({
            success: true,
            message: 'Đăng ký thành công',
            data: result,
        });
    } catch (error) {
        next(error);
    }
});

router.post('/forgot-password', otpRequestLimiter, async (req, res, next) => {
    try {
        const { email } = z.object({
            email: z.string().trim().email('Email không hợp lệ').transform((value) => value.toLowerCase()),
        }).parse(req.body);
        const result = await authService.requestPasswordResetOtp(email);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

router.post('/reset-password', otpVerifyLimiter, async (req, res, next) => {
    try {
        const result = await authService.resetPassword(resetPasswordSchema.parse(req.body));
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

router.post('/refresh', async (req, res, next) => {
    try {
        const { refreshToken } = refreshSchema.parse(req.body);
        const tokens = await authService.refreshToken(refreshToken);

        res.json({
            success: true,
            data: tokens,
        });
    } catch (error) {
        next(error);
    }
});

router.post('/logout', authenticate, async (req, res, next) => {
    try {
        const refreshToken = req.body.refreshToken;
        await authService.logout(req.user!.userId, refreshToken);

        res.json({
            success: true,
            message: 'Đăng xuất thành công',
        });
    } catch (error) {
        next(error);
    }
});

router.get('/me', authenticate, async (req, res, next) => {
    try {
        const user = await authService.getProfile(req.user!.userId);

        res.json({
            success: true,
            data: user,
        });
    } catch (error) {
        next(error);
    }
});

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Mật khẩu hiện tại không được để trống'),
    newPassword: newPasswordSchema,
});

router.post('/change-password', authenticate, async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
        const result = await authService.changePassword(req.user!.userId, currentPassword, newPassword);

        res.json({
            success: true,
            message: result.message,
        });
    } catch (error) {
        next(error);
    }
});

router.post('/logout-all', authenticate, async (req, res, next) => {
    try {
        const result = await authService.logoutAllDevices(req.user!.userId);

        res.json({
            success: true,
            message: result.message,
        });
    } catch (error) {
        next(error);
    }
});

export default router;
