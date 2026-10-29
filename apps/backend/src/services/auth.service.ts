import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { randomInt } from 'node:crypto';
import { config } from '../config/index.js';
import prisma from '../config/database.js';
import { AppError } from '../middleware/error.js';
import { JwtPayload, UserRole } from '../middleware/auth.js';
import { mailService } from './mail.service.js';

export interface LoginInput {
    email: string;
    password: string;
}

export interface RegisterInput {
    email: string;
    password: string;
    name: string;
    phone?: string;
}

type AdminOtpPurpose = 'PASSWORD_RESET';

interface AdminOtpInput {
    email: string;
    otp: string;
}

export interface AuthResponse {
    user: {
        id: string;
        email: string;
        name: string;
        role: string;
    };
    accessToken: string;
    refreshToken: string;
}

export class AuthService {
    private generateTokens(payload: JwtPayload) {
        const accessToken = jwt.sign(payload, config.jwt.secret, {
            expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'],
        });

        const refreshToken = jwt.sign(
            { userId: payload.userId },
            config.jwt.refreshSecret,
            { expiresIn: config.jwt.refreshExpiresIn as SignOptions['expiresIn'] }
        );

        return { accessToken, refreshToken };
    }

    async login(input: LoginInput): Promise<AuthResponse> {
        const user = await prisma.user.findUnique({
            where: { email: input.email },
        });

        if (!user) {
            throw new AppError(401, 'Email hoặc mật khẩu không đúng');
        }

        if (!user.isActive) {
            throw new AppError(401, 'Tài khoản đã bị vô hiệu hóa');
        }

        const validPassword = await bcrypt.compare(input.password, user.passwordHash);
        if (!validPassword) {
            throw new AppError(401, 'Email hoặc mật khẩu không đúng');
        }

        const payload: JwtPayload = {
            userId: user.id,
            email: user.email,
            role: user.role as UserRole,
        };

        const { accessToken, refreshToken } = this.generateTokens(payload);

        // Store refresh token in database
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

        await prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: user.id,
                expiresAt,
            },
        });

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
            accessToken,
            refreshToken,
        };
    }

    private async createAdminOtp(email: string, purpose: AdminOtpPurpose) {
        const recentOtp = await prisma.adminAuthOtp.findFirst({
            where: { email, purpose },
            orderBy: { createdAt: 'desc' },
        });
        if (recentOtp && Date.now() - recentOtp.createdAt.getTime() < 60_000) {
            throw new AppError(429, 'Vui lòng đợi 60 giây trước khi yêu cầu mã mới');
        }

        await prisma.adminAuthOtp.deleteMany({ where: { email, purpose } });
        const otp = randomInt(100000, 1000000).toString();
        const record = await prisma.adminAuthOtp.create({
            data: {
                email,
                purpose,
                otpHash: await bcrypt.hash(otp, 10),
                expiresAt: new Date(Date.now() + 5 * 60_000),
            },
        });

        try {
            await mailService.sendOTP(email, otp, 'password-reset');
        } catch (error) {
            await prisma.adminAuthOtp.deleteMany({ where: { id: record.id } });
            throw error;
        }
    }

    async register(input: RegisterInput): Promise<AuthResponse> {
        const email = input.email.trim().toLowerCase();
        const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        if (existingUser) throw new AppError(409, 'Email đã được sử dụng');

        const user = await prisma.user.create({
            data: {
                email,
                passwordHash: await bcrypt.hash(input.password, 12),
                name: input.name.trim(),
                phone: input.phone?.trim() || null,
                role: 'STAFF',
            },
        });

        const { accessToken, refreshToken } = this.generateTokens({
            userId: user.id,
            email: user.email,
            role: user.role as UserRole,
        });
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await prisma.refreshToken.create({
            data: { token: refreshToken, userId: user.id, expiresAt },
        });

        return {
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
            accessToken,
            refreshToken,
        };
    }

    async requestPasswordResetOtp(emailInput: string): Promise<{ message: string }> {
        const email = emailInput.trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email }, select: { id: true, isActive: true } });
        if (user?.isActive) {
            try {
                await this.createAdminOtp(email, 'PASSWORD_RESET');
            } catch (error) {
                if (!(error instanceof AppError) || error.statusCode !== 429) throw error;
            }
        }

        return { message: 'Nếu email thuộc tài khoản đang hoạt động, mã đặt lại mật khẩu sẽ được gửi đến email đó' };
    }

    async resetPassword(input: AdminOtpInput & { newPassword: string }): Promise<{ message: string }> {
        const email = input.email.trim().toLowerCase();
        const record = await prisma.adminAuthOtp.findFirst({
            where: { email, purpose: 'PASSWORD_RESET' },
            orderBy: { createdAt: 'desc' },
        });
        if (!record || record.expiresAt <= new Date() || record.attempts >= 5) {
            throw new AppError(400, 'Mã OTP không hợp lệ hoặc đã hết hạn');
        }
        if (!await bcrypt.compare(input.otp, record.otpHash)) {
            await prisma.adminAuthOtp.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
            throw new AppError(400, 'Mã OTP không hợp lệ hoặc đã hết hạn');
        }

        const passwordHash = await bcrypt.hash(input.newPassword, 12);
        await prisma.$transaction(async (transaction) => {
            const consumed = await transaction.adminAuthOtp.deleteMany({
                where: { id: record.id, expiresAt: { gt: new Date() }, attempts: { lt: 5 } },
            });
            if (consumed.count !== 1) throw new AppError(400, 'Mã OTP không hợp lệ hoặc đã hết hạn');

            const user = await transaction.user.findUnique({ where: { email }, select: { id: true, isActive: true } });
            if (!user?.isActive) throw new AppError(400, 'Tài khoản không thể đặt lại mật khẩu');

            await transaction.user.update({ where: { id: user.id }, data: { passwordHash } });
            await transaction.refreshToken.deleteMany({ where: { userId: user.id } });
        });

        return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' };
    }

    async refreshToken(token: string): Promise<{ accessToken: string; refreshToken: string }> {
        // Verify refresh token
        let decoded: { userId: string };
        try {
            decoded = jwt.verify(token, config.jwt.refreshSecret) as { userId: string };
        } catch {
            throw new AppError(401, 'Refresh token không hợp lệ');
        }

        // Check token in database
        const storedToken = await prisma.refreshToken.findUnique({
            where: { token },
            include: { user: true },
        });

        if (!storedToken || storedToken.expiresAt < new Date()) {
            throw new AppError(401, 'Refresh token đã hết hạn');
        }

        if (!storedToken.user.isActive) {
            throw new AppError(401, 'Tài khoản đã bị vô hiệu hóa');
        }

        // Delete old refresh token
        await prisma.refreshToken.deleteMany({
            where: { id: storedToken.id },
        });

        // Generate new tokens
        const payload: JwtPayload = {
            userId: storedToken.user.id,
            email: storedToken.user.email,
            role: storedToken.user.role as UserRole,
        };

        const tokens = this.generateTokens(payload);

        // Store new refresh token
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await prisma.refreshToken.create({
            data: {
                token: tokens.refreshToken,
                userId: storedToken.user.id,
                expiresAt,
            },
        });

        return tokens;
    }

    async logout(userId: string, refreshToken?: string) {
        if (refreshToken) {
            // Delete specific refresh token
            await prisma.refreshToken.deleteMany({
                where: { token: refreshToken },
            });
        } else {
            // Delete all refresh tokens for user
            await prisma.refreshToken.deleteMany({
                where: { userId },
            });
        }
    }

    async getProfile(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                avatar: true,
                role: true,
                lastLoginAt: true,
                createdAt: true,
            },
        });

        if (!user) {
            throw new AppError(404, 'Không tìm thấy người dùng');
        }

        return user;
    }

    async changePassword(userId: string, currentPassword: string, newPassword: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new AppError(404, 'Không tìm thấy người dùng');
        }

        const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!validPassword) {
            throw new AppError(400, 'Mật khẩu hiện tại không đúng');
        }

        if (newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) {
            throw new AppError(400, 'Mật khẩu mới phải có ít nhất 8 ký tự và không vượt quá 72 byte');
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 12);

        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash: newPasswordHash },
        });

        // Delete all refresh tokens to force re-login
        await prisma.refreshToken.deleteMany({
            where: { userId },
        });

        return { message: 'Đổi mật khẩu thành công' };
    }

    async logoutAllDevices(userId: string) {
        await prisma.refreshToken.deleteMany({
            where: { userId },
        });
        return { message: 'Đã đăng xuất khỏi tất cả thiết bị' };
    }
}

export const authService = new AuthService();
