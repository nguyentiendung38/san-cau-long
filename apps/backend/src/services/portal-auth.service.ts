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

    
    
    async requestHueOtp(customerId: string, data: { studentId: string; faculty: string; email: string }) {
        const studentId = String(data.studentId || '').trim().toUpperCase();
        const faculty = String(data.faculty || '').trim();
        const email = String(data.email || '').trim().toLowerCase();

        // 1. Kiểm tra tài khoản hiện tại đã xác thực chưa
        const currentCustomer = await prisma.customer.findUnique({
            where: { id: customerId },
            select: { isVerifiedHue: true, studentId: true } as any,
        });
        if (currentCustomer && (currentCustomer as any).isVerifiedHue) {
            throw new AppError(400, `Tài khoản này đã được xác thực với MSSV ${(currentCustomer as any).studentId || ''}. Không thể thay đổi.`);
        }

        // 2. Kiểm tra định dạng MSSV
        const mssvRegex = /^[0-9]{2}[A-Z][0-9]{5,8}$/;
        if (!studentId || !mssvRegex.test(studentId)) {
            throw new AppError(400, 'Mã số sinh viên không đúng định dạng trường HCE (Ví dụ chuẩn: 21K4080123)');
        }

        if (!faculty) {
            throw new AppError(400, 'Vui lòng chọn Khoa / Viện trực thuộc');
        }

        // 3. Kiểm tra email sinh viên có đuôi @hce.edu.vn
        if (!email || !email.includes('@')) {
            throw new AppError(400, 'Vui lòng nhập Email sinh viên');
        }
        if (!email.endsWith('@hce.edu.vn')) {
            throw new AppError(400, `Email sinh viên không hợp lệ. Vui lòng sử dụng email chính thức do trường cấp với đuôi @hce.edu.vn (Ví dụ: ${studentId.toLowerCase()}@hce.edu.vn)`);
        }

        // 4. Kiểm tra MSSV này đã được xác thực bởi tài khoản khác chưa
        const existingStudent = await prisma.customer.findFirst({
            where: {
                studentId,
                id: { not: customerId },
                isVerifiedHue: true,
            },
            select: { id: true },
        });
        if (existingStudent) {
            throw new AppError(409, `Mã số sinh viên ${studentId} đã được xác thực bởi một tài khoản khác`);
        }

        // 5. Kiểm tra email học đường này đã được gắn với tài khoản khác chưa
        const existingEmail = await prisma.customer.findFirst({
            where: {
                email,
                id: { not: customerId },
                isVerifiedHue: true,
            },
            select: { id: true },
        });
        if (existingEmail) {
            throw new AppError(409, `Email sinh viên ${email} đã được xác thực bởi một tài khoản khác`);
        }

        // 6. Xóa các OTP cũ chưa dùng của email này
        await prisma.otpRecord.deleteMany({
            where: { email },
        });

        // 7. Tạo mã OTP 6 chữ số
        const otp = randomInt(100000, 1000000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

        await prisma.otpRecord.create({
            data: {
                email,
                otp,
                expiresAt,
            },
        });

        // 8. Gửi email OTP
        await mailService.sendStudentVerificationOTP(email, otp, studentId, faculty);

        return {
            message: `Mã OTP xác thực đã được gửi đến email ${email}. Vui lòng kiểm tra hộp thư để nhận mã.`,
            email,
            devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
        };
    },

    async verifyHueOtp(customerId: string, data: { studentId: string; faculty: string; email: string; otp: string; customerType?: string }) {
        const studentId = String(data.studentId || '').trim().toUpperCase();
        const faculty = String(data.faculty || '').trim();
        const email = String(data.email || '').trim().toLowerCase();
        const otp = String(data.otp || '').trim();
        const customerType = data.customerType || 'STUDENT';

        if (!otp || otp.length < 6) {
            throw new AppError(400, 'Vui lòng nhập đủ 6 chữ số mã OTP');
        }

        // 1. Kiểm tra tài khoản hiện tại đã xác thực chưa
        const currentCustomer = await prisma.customer.findUnique({
            where: { id: customerId },
            select: { isVerifiedHue: true, studentId: true } as any,
        });
        if (currentCustomer && (currentCustomer as any).isVerifiedHue) {
            throw new AppError(400, `Tài khoản này đã được xác thực với MSSV ${(currentCustomer as any).studentId || ''}.`);
        }

        // 2. Tìm mã OTP trong database
        const otpRecord = await prisma.otpRecord.findFirst({
            where: {
                email,
                otp,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        if (!otpRecord) {
            throw new AppError(400, 'Mã OTP không chính xác. Vui lòng kiểm tra lại hộp thư sinh viên.');
        }

        if (otpRecord.expiresAt < new Date()) {
            throw new AppError(400, 'Mã OTP đã hết hạn (quá 5 phút). Vui lòng yêu cầu gửi lại mã.');
        }

        // 3. Cập nhật thông tin sinh viên
        const updated = await prisma.customer.update({
            where: { id: customerId },
            data: {
                studentId,
                faculty,
                customerType,
                isVerifiedHue: true,
            } as any,
            select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                studentId: true,
                faculty: true,
                customerType: true,
                isVerifiedHue: true,
                points: true,
                reservedPoints: true,
            } as any,
        });

        try {
            await prisma.$executeRawUnsafe('UPDATE customers SET isVerifiedHue = 1 WHERE id = ?', customerId);
        } catch (_) {}

        // 4. Xóa OTP sau khi dùng xong
        await prisma.otpRecord.deleteMany({
            where: { email },
        });

        return {
            ...updated,
            isVerifiedHue: true,
        };
    },

    async verifyHue(customerId: string, data: { studentId: string; faculty: string; customerType?: string }) {
        const studentId = String(data.studentId || '').trim().toUpperCase();
        const faculty = String(data.faculty || '').trim();
        const customerType = data.customerType || 'STUDENT';

        // 0. Kiểm tra tài khoản đã xác thực trước đó chưa (Chặn nhập đi nhập lại nhiều mã)
        const currentCustomer = await prisma.customer.findUnique({
            where: { id: customerId },
            select: { isVerifiedHue: true, studentId: true } as any,
        });
        if (currentCustomer && (currentCustomer as any).isVerifiedHue) {
            throw new AppError(400, `Tài khoản này đã được xác thực với MSSV ${(currentCustomer as any).studentId || ''}. Để đảm bảo chính chủ, không thể tự ý thay đổi.`);
        }

        // 1. Kiểm tra cấu trúc MSSV Đại học Huế / ĐH Kinh tế Huế (VD: 21K4080123, 22K4020111)
        const mssvRegex = /^[0-9]{2}[A-Z][0-9]{5,8}$/;
        if (!studentId || !mssvRegex.test(studentId)) {
            throw new AppError(400, 'Mã số sinh viên không đúng định dạng trường (Ví dụ chuẩn: 21K4080123)');
        }

        // 2. Chống dùng chung MSSV (Mỗi sinh viên chỉ kích hoạt trên 1 tài khoản)
        const existingStudent = await prisma.customer.findFirst({
            where: {
                studentId,
                id: { not: customerId },
                isVerifiedHue: true,
            },
            select: { id: true },
        });
        if (existingStudent) {
            throw new AppError(409, `Mã số sinh viên ${studentId} đã được xác thực bởi một tài khoản khác`);
        }

        if (!faculty) {
            throw new AppError(400, 'Vui lòng chọn Khoa / Viện trực thuộc');
        }

        const updated = await prisma.customer.update({
            where: { id: customerId },
            data: {
                studentId,
                faculty,
                customerType,
                isVerifiedHue: true,
            } as any,
            select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                studentId: true,
                faculty: true,
                customerType: true,
                isVerifiedHue: true,
                points: true,
                reservedPoints: true,
            } as any
        });

        try {
            await prisma.$executeRawUnsafe('UPDATE customers SET isVerifiedHue = 1 WHERE id = ?', customerId);
        } catch (_) {}

        return {
            ...updated,
            isVerifiedHue: true,
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
                studentId: true,
                faculty: true,
                customerType: true,
                isVerifiedHue: true,
                points: true,
                reservedPoints: true,
                pointsTransactions: {
                    where: { points: { not: 0 } },
                    orderBy: { createdAt: 'desc' },
                    take: 50,
                },
            } as any,
        });
        if (!customer) throw new AppError(404, 'Không tìm thấy tài khoản khách hàng');
        return {
            ...customer,
            isVerifiedHue: Boolean((customer as any).isVerifiedHue || (customer as any).isVerifiedHue),
        };
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
