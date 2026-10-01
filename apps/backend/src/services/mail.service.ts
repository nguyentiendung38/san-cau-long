import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

let transporterInstance: nodemailer.Transporter | null = null;

export const mailService = {
    getTransporter() {
        if (!transporterInstance) {
            transporterInstance = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.GMAIL_USER || 'hethongdatsan@gmail.com',
                    pass: process.env.GMAIL_PASS || 'your-app-password'
                }
            });
        }
        return transporterInstance;
    },

    async sendOTP(to: string, otp: string) {
        const mailOptions = {
            from: process.env.GMAIL_USER || 'hethongdatsan@gmail.com',
            to,
            subject: 'M? xác nh?n ðãng k? tài kho?n Courtify',
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; padding: 40px 20px; border-radius: 12px;">
                    <div style="background-color: #ffffff; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); text-align: center;">
                        <h1 style="color: #16a34a; margin-top: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Courtify</h1>
                        <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 24px; font-weight: 600;">Xác nh?n ðãng k? tài kho?n</h2>
                        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 32px; text-align: left;">
                            Chào b?n,<br><br>
                            C?m õn b?n ð? ðãng k? tài kho?n t?i h? th?ng ð?t sân c?u lông Courtify. Ð? hoàn t?t quá tr?nh ðãng k?, vui l?ng s? d?ng m? xác nh?n dý?i ðây:
                        </p>
                        <div style="background-color: #f0fdf4; border: 2px dashed #86efac; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                            <strong style="font-size: 42px; color: #16a34a; letter-spacing: 12px; font-weight: 900; display: block; text-align: center;">${otp}</strong>
                        </div>
                        <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-bottom: 0; text-align: left;">
                            M? xác nh?n này có hi?u l?c trong <strong>5 phút</strong>.<br>
                            V? l? do b?o m?t, vui l?ng không chia s? m? này cho b?t k? ai.
                        </p>
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
                        <p style="color: #9ca3af; font-size: 13px; margin: 0;">
                            Trân tr?ng,<br>
                            <strong>Ð?i ng? Courtify</strong>
                        </p>
                    </div>
                </div>
            `
        };

        try {
            await this.getTransporter().sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('L?i g?i mail:', error);
            console.log('--- TEST MODE: EMAIL CREDENTIALS MIGHT BE MISSING ---');
            console.log(`[TEST OTP] M? OTP C?A EMAIL ${to} Là: ${otp}`);
            return false;
        }
    }
};
