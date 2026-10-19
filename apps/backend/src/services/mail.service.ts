import nodemailer, { type Transporter } from 'nodemailer';
import { AppError } from '../middleware/error.js';

let transporterInstance: Transporter | null = null;

function getTransporter(): Transporter {
    if (transporterInstance) return transporterInstance;

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT || 465);
    const user = process.env.SMTP_USER || process.env.GMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.GMAIL_PASS;

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new AppError(503, 'Cấu hình cổng SMTP không hợp lệ');
    }
    if (!user || !pass || pass === 'your-app-password') {
        throw new AppError(503, 'Chưa cấu hình SMTP. Vui lòng cấu hình SMTP_USER và SMTP_PASS để gửi OTP.');
    }

    transporterInstance = nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE
            ? process.env.SMTP_SECURE.toLowerCase() === 'true'
            : port === 465,
        auth: { user, pass },
    });

    return transporterInstance;
}

export const mailService = {
    async sendNotification(to: string, subject: string, text: string, html: string): Promise<void> {
        const from = process.env.SMTP_FROM || process.env.GMAIL_USER || process.env.SMTP_USER;
        if (!from) throw new AppError(503, 'Chưa cấu hình địa chỉ email gửi SMTP (SMTP_FROM)');
        const transporter = getTransporter();
        await transporter.sendMail({ from, to, subject, text, html });
    },

    async sendOTP(to: string, otp: string): Promise<void> {
        const from = process.env.SMTP_FROM || process.env.GMAIL_USER || process.env.SMTP_USER;
        if (!from) {
            throw new AppError(503, 'Chưa cấu hình địa chỉ email gửi SMTP (SMTP_FROM)');
        }
        const transporter = getTransporter();

        try {
            await transporter.sendMail({
                from,
                to,
                subject: 'Mã xác nhận tài khoản Courtify',
                textEncoding: 'base64',
                text: `Mã xác nhận Courtify của bạn là ${otp}. Mã có hiệu lực trong 5 phút. Không chia sẻ mã này với bất kỳ ai.`,
                html: `
                    <!doctype html>
                    <html lang="vi">
                    <head>
                        <meta charset="UTF-8">
                        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Mã xác nhận Courtify</title>
                    </head>
                    <body style="margin:0;padding:32px 16px;background-color:#f1f5f9;font-family:Arial,'Helvetica Neue',Helvetica,Tahoma,sans-serif;color:#172033;-webkit-text-size-adjust:100%">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:20px">
                            <tr>
                                <td style="padding:36px 32px">
                                    <div style="font-size:13px;font-weight:700;letter-spacing:2px;color:#15803d">COURTIFY</div>
                                    <h1 style="margin:24px 0 8px;font-size:26px;line-height:1.3;color:#0f172a">Mã xác nhận của bạn</h1>
                                    <p style="margin:0;color:#475569;font-size:15px;line-height:1.7">Nhập mã bên dưới để tiếp tục. Mã có hiệu lực trong <strong>5 phút</strong>.</p>
                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:28px 0">
                                        <tr>
                                            <td align="center" style="padding:22px 12px;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px">
                                                <strong style="font-family:Arial,'Helvetica Neue',Helvetica,Tahoma,sans-serif;font-size:36px;line-height:1.2;letter-spacing:10px;color:#15803d">${otp}</strong>
                                            </td>
                                        </tr>
                                    </table>
                                    <p style="margin:0;color:#64748b;font-size:13px;line-height:1.7">Nếu bạn không yêu cầu mã này, hãy bỏ qua email. Vì lý do bảo mật, không chia sẻ mã với bất kỳ ai.</p>
                                    <div style="height:1px;margin:28px 0;background-color:#e2e8f0"></div>
                                    <p style="margin:0;color:#64748b;font-size:13px;line-height:1.7">Trân trọng,<br><strong style="color:#334155">Đội ngũ Courtify</strong></p>
                                </td>
                            </tr>
                        </table>
                    </body>
                    </html>
                `,
            });
        } catch (error) {
            console.error(
                'Không gửi được email OTP:',
                error instanceof Error ? error.message : 'Lỗi SMTP không xác định',
            );
            throw new AppError(502, 'Gửi email OTP thất bại. Vui lòng kiểm tra cấu hình SMTP hoặc thử lại sau.');
        }
    },
};
