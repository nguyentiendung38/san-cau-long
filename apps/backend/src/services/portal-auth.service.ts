import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomInt } from 'node:crypto';
import { AppError } from '../middleware/error.js';
import { mailService } from './mail.service.js';
import { config } from '../config/index.js';

const prisma = new PrismaClient();
const JWT_SECRET = config.jwt.secret;

export const portalAuthService = {
    async requestOtp(data: any) {
        const email = String(data.email || '').trim().toLowerCase();
        const phone = String(data.phone || '').trim();
        if (!email) {
            throw new AppError(400, 'Vui lòng cung cấp Email để nhận OTP');
        }

        // Check if phone or email already exists in customers
        const existingPhone = await prisma.customer.findUnique({
            where: { phone }
        });
        if (existingPhone && existingPhone.passwordHash) {
            throw new AppError(409, 'Số điện thoại này đã được đăng ký');
        }

        const existingEmail = await prisma.customer.findFirst({
            where: { email }
        });
        if (existingEmail && existingEmail.passwordHash) {
            throw new AppError(409, 'Email này đã được đăng ký');
        }

        // Generate 6-digit OTP
        const otp = randomInt(100000, 1000000).toString();
        
        // Save to OtpRecord
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        const otpRecord = await prisma.otpRecord.create({
            data: {
                email,
                otp,
                expiresAt
            }
        });

        try {
            await mailService.sendOTP(email, otp);
        } catch (error) {
            await prisma.otpRecord.delete({ where: { id: otpRecord.id } });
            throw error;
        }

        return { message: 'Đã gửi mã OTP về email của bạn' };
    },

    async verifyAndRegister(data: any) {
        // Validate OTP
        const otpRecord = await prisma.otpRecord.findFirst({
            where: {
                email: String(data.email || '').trim().toLowerCase(),
                otp: data.otp,
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        if (!otpRecord) {
            throw new AppError(400, 'Mã OTP không hợp lệ');
        }

        if (otpRecord.expiresAt < new Date()) {
            throw new AppError(400, 'Mã OTP đã hết hạn');
        }

        // OTP is valid, register customer
        const passwordHash = await bcrypt.hash(data.password, 12);
        
        const phone = String(data.phone || '').trim();
        const email = String(data.email || '').trim().toLowerCase();
        const existingEmail = await prisma.customer.findFirst({
            where: { email, NOT: { phone } },
            select: { id: true },
        });
        if (existingEmail) throw new AppError(409, 'Email này đã được sử dụng bởi tài khoản khác');

        const customer = await prisma.customer.upsert({
            where: { phone },
            update: { name: data.name, email, passwordHash },
            create: { name: data.name, phone, email, passwordHash }
        });

        // Delete all OTP records for this email after successful registration
        await prisma.otpRecord.deleteMany({
            where: { email: data.email }
        });

        const token = jwt.sign({ id: customer.id, role: 'CUSTOMER' }, JWT_SECRET, { expiresIn: '7d' });
        
        return {
            token,
            customer: {
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                email: customer.email
            }
        };
    },

    async login(data: any) {
        // Login by phone or email
        let customer;
        if (data.identifier.includes('@')) {
            customer = await prisma.customer.findFirst({ where: { email: data.identifier.trim().toLowerCase() } });
        } else {
            customer = await prisma.customer.findUnique({ where: { phone: data.identifier.trim() } });
        }

        if (!customer || !customer.passwordHash) {
            throw new AppError(401, 'Tài khoản hoặc mật khẩu không đúng');
        }

        const valid = await bcrypt.compare(data.password, customer.passwordHash);
        if (!valid) {
            throw new AppError(401, 'Tài khoản hoặc mật khẩu không đúng');
        }

        const token = jwt.sign({ id: customer.id, role: 'CUSTOMER' }, JWT_SECRET, { expiresIn: '7d' });
        
        return {
            token,
            customer: {
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                email: customer.email
            }
        };
    },

    async getCustomerLoyalty(customerId: string) {
        const customer = await prisma.customer.findUnique({
            where: { id: customerId },
            select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                points: true,
                reservedPoints: true,
                pointsTransactions: {
                    where: { points: { not: 0 } },
                    orderBy: { createdAt: 'desc' },
                    take: 50,
                },
            },
        });
        if (!customer) throw new AppError(404, 'Không tìm thấy tài khoản khách hàng');
        return customer;
    },

    async requestResetPasswordOtp(data: { email: string }) {
        const email = data.email.trim().toLowerCase();
        if (!email) {
            throw new AppError(400, 'Vui lòng cung cấp Email');
        }

        const customer = await prisma.customer.findFirst({
            where: { email }
        });
        if (!customer) {
            throw new AppError(404, 'Không tìm thấy tài khoản với email này');
        }

        // Generate 6-digit OTP
        const otp = randomInt(100000, 1000000).toString();
        
        // Save to OtpRecord
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        const otpRecord = await prisma.otpRecord.create({
            data: {
                email,
                otp,
                expiresAt
            }
        });

        try {
            await mailService.sendOTP(email, otp);
        } catch (error) {
            await prisma.otpRecord.delete({ where: { id: otpRecord.id } });
            throw error;
        }

        return { message: 'Đã gửi mã OTP khôi phục mật khẩu về email của bạn' };
    },

    async resetPassword(data: any) {
        // Validate OTP
        const otpRecord = await prisma.otpRecord.findFirst({
            where: {
                email: data.email.trim().toLowerCase(),
                otp: data.otp,
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        if (!otpRecord) {
            throw new AppError(400, 'Mã OTP không hợp lệ');
        }

        if (otpRecord.expiresAt < new Date()) {
            throw new AppError(400, 'Mã OTP đã hết hạn');
        }

        // OTP is valid, reset password
        const passwordHash = await bcrypt.hash(data.newPassword, 12);
        
        await prisma.customer.updateMany({
            where: { email: data.email.trim().toLowerCase() },
            data: { passwordHash }
        });

        // Delete all OTP records for this email
        await prisma.otpRecord.deleteMany({
            where: { email: data.email.trim().toLowerCase() }
        });

        return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' };
    }
};
