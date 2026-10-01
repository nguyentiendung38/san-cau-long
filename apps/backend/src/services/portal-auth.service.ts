import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../middleware/error.js';
import { mailService } from './mail.service.js';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export const portalAuthService = {
    async requestOtp(data: any) {
        if (!data.email) {
            throw new AppError(400, 'Vui lòng cung cấp Email để nhận OTP');
        }

        // Check if phone or email already exists in customers
        const existingPhone = await prisma.customer.findUnique({
            where: { phone: data.phone }
        });
        if (existingPhone) {
            throw new AppError(409, 'Số điện thoại này đã được đăng ký');
        }

        const existingEmail = await prisma.customer.findFirst({
            where: { email: data.email }
        });
        if (existingEmail) {
            throw new AppError(409, 'Email này đã được đăng ký');
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Save to OtpRecord
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        await prisma.otpRecord.create({
            data: {
                email: data.email,
                otp,
                expiresAt
            }
        });

        // Send Email
        const sent = await mailService.sendOTP(data.email, otp);

        if (!sent) {
            return { message: `Gửi mail thất bại do chưa cấu hình SMTP. (MÃ OTP TEST LÀ: ${otp})` };
        }

        return { message: 'Đã gửi mã OTP về email của bạn' };
    },

    async verifyAndRegister(data: any) {
        // Validate OTP
        const otpRecord = await prisma.otpRecord.findFirst({
            where: {
                email: data.email,
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
        
        const customer = await prisma.customer.create({
            data: {
                name: data.name,
                phone: data.phone,
                email: data.email,
                passwordHash
            }
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

    async register(data: any) {
        // Legacy direct register
        const existing = await prisma.customer.findUnique({
            where: { phone: data.phone }
        });
        
        if (existing) {
            throw new AppError(409, 'Số điện thoại này đã được đăng ký');
        }

        const passwordHash = await bcrypt.hash(data.password, 12);
        
        const customer = await prisma.customer.create({
            data: {
                name: data.name,
                phone: data.phone,
                email: data.email || null,
                passwordHash
            }
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
            customer = await prisma.customer.findFirst({ where: { email: data.identifier } });
        } else {
            customer = await prisma.customer.findUnique({ where: { phone: data.identifier } });
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

    async requestResetPasswordOtp(data: { email: string }) {
        if (!data.email) {
            throw new AppError(400, 'Vui lòng cung cấp Email');
        }

        const customer = await prisma.customer.findFirst({
            where: { email: data.email }
        });
        if (!customer) {
            throw new AppError(404, 'Không tìm thấy tài khoản với email này');
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Save to OtpRecord
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        await prisma.otpRecord.create({
            data: {
                email: data.email,
                otp,
                expiresAt
            }
        });

        // Send Email
        const sent = await mailService.sendOTP(data.email, otp);

        if (!sent) {
            return { message: `Gửi mail thất bại (Chưa cấu hình SMTP). MÃ OTP TEST LÀ: ${otp}` };
        }

        return { message: 'Đã gửi mã OTP khôi phục mật khẩu về email của bạn' };
    },

    async resetPassword(data: any) {
        // Validate OTP
        const otpRecord = await prisma.otpRecord.findFirst({
            where: {
                email: data.email,
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
            where: { email: data.email },
            data: { passwordHash }
        });

        // Delete all OTP records for this email
        await prisma.otpRecord.deleteMany({
            where: { email: data.email }
        });

        return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' };
    }
};
