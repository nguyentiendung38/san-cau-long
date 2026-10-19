import prisma from '../config/database.js';
import { mailService } from './mail.service.js';

const escapeHtml = (value: string) => value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

class NotificationService {
    private processing = false;

    async enqueue(input: {
        customerId?: string | null;
        email?: string | null;
        dedupeKey: string;
        subject: string;
        text: string;
        scheduledAt?: Date;
    }) {
        try {
            const email = input.email || (input.customerId
                ? (await prisma.customer.findUnique({
                    where: { id: input.customerId },
                    select: { email: true },
                }))?.email
                : null);
            if (!email?.trim()) return;
            const text = input.text;
            const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033"><p>${escapeHtml(text).replaceAll('\n', '<br>')}</p><p>Trân trọng,<br>Đội ngũ Courtify</p></div>`;
            await prisma.emailNotification.create({
                data: {
                    dedupeKey: input.dedupeKey,
                    toEmail: email.trim(),
                    subject: input.subject,
                    text,
                    html,
                    scheduledAt: input.scheduledAt || new Date(),
                    nextAttemptAt: input.scheduledAt || new Date(),
                },
            });
        } catch (error) {
            if ((error as { code?: string })?.code === 'P2002') return;
            console.error('Không thể lưu email vào hàng đợi:', error instanceof Error ? error.message : error);
        }
    }

    async paymentDeadline(request: {
        id: string; customerId: string | null; name: string; venueId: string;
        courtId: string | null; date: Date; startTime: string; endTime: string;
        transferReference: string | null; expiresAt: Date | null; paymentAmount: number;
    }) {
        const [venue, court] = await Promise.all([
            prisma.venue.findUnique({ where: { id: request.venueId }, select: { name: true } }),
            request.courtId ? prisma.court.findUnique({ where: { id: request.courtId }, select: { name: true } }) : null,
        ]);
        await this.enqueue({
            customerId: request.customerId,
            dedupeKey: `booking-request:${request.id}:payment-deadline`,
            subject: 'Thông tin thanh toán và thời hạn giữ sân',
            text: `Chào ${request.name},\nYêu cầu đặt sân tại ${venue?.name || 'cơ sở'}${court ? ` - ${court.name}` : ''} vào ${request.startTime}-${request.endTime} ngày ${request.date.toLocaleDateString('vi-VN')} đang chờ thanh toán.\nVui lòng chuyển ${request.paymentAmount.toLocaleString('vi-VN')}đ với nội dung ${request.transferReference || request.id} trong vòng 30 phút${request.expiresAt ? ` (trước ${request.expiresAt.toLocaleTimeString('vi-VN')})` : ''}. Nếu đã chuyển khoản, cơ sở sẽ xác nhận sau khi đối soát.`,
        });
    }

    async bookingDecision(request: {
        id: string; customerId: string | null; name: string; venueId: string;
        courtId: string | null; date: Date; startTime: string; endTime: string; status: string;
    }) {
        const [venue, court] = await Promise.all([
            prisma.venue.findUnique({ where: { id: request.venueId }, select: { name: true } }),
            request.courtId ? prisma.court.findUnique({ where: { id: request.courtId }, select: { name: true } }) : null,
        ]);
        const approved = request.status === 'APPROVED';
        await this.enqueue({
            customerId: request.customerId,
            dedupeKey: `booking-request:${request.id}:decision:${request.status}`,
            subject: approved ? 'Yêu cầu đặt sân đã được xác nhận' : 'Cập nhật yêu cầu đặt sân',
            text: `Chào ${request.name}, yêu cầu đặt sân tại ${venue?.name || 'cơ sở'}${court ? ` - ${court.name}` : ''} vào ${request.startTime}-${request.endTime} ngày ${request.date.toLocaleDateString('vi-VN')} đã được ${approved ? 'xác nhận' : 'từ chối'}.`,
        });
    }

    async bookingExpired(request: {
        id: string; customerId: string | null; name: string; venueId: string;
        courtId: string | null; date: Date; startTime: string; endTime: string;
    }) {
        const [venue, court] = await Promise.all([
            prisma.venue.findUnique({ where: { id: request.venueId }, select: { name: true } }),
            request.courtId ? prisma.court.findUnique({ where: { id: request.courtId }, select: { name: true } }) : null,
        ]);
        await this.enqueue({
            customerId: request.customerId,
            dedupeKey: `booking-request:${request.id}:expired`,
            subject: 'Yêu cầu đặt sân đã hết hạn',
            text: `Chào ${request.name}, yêu cầu đặt sân tại ${venue?.name || 'cơ sở'}${court ? ` - ${court.name}` : ''} vào ${request.startTime}-${request.endTime} ngày ${request.date.toLocaleDateString('vi-VN')} đã hết hạn vì chưa được xác nhận thanh toán trong 30 phút. Khung giờ đã được mở lại. Bạn có thể tạo yêu cầu mới nếu lịch vẫn còn trống.`,
        });
    }

    async bookingChangeRequest(request: {
        id: string;
        customerId: string | null;
        name: string;
        venueId: string;
        courtId: string | null;
        date: Date;
        startTime: string;
        endTime: string;
        cancellationRequestType: string | null;
        cancellationRequestReason: string | null;
        requestedDate: Date | null;
        requestedStartTime: string | null;
        requestedEndTime: string | null;
        cancellationRequestedAt: Date | null;
    }, event: 'SUBMITTED' | 'APPROVED' | 'REJECTED') {
        const [venue, court] = await Promise.all([
            prisma.venue.findUnique({ where: { id: request.venueId }, select: { name: true } }),
            request.courtId ? prisma.court.findUnique({ where: { id: request.courtId }, select: { name: true } }) : null,
        ]);
        const typeLabel = request.cancellationRequestType === 'RESCHEDULE' ? 'đổi lịch' : 'hủy lịch';
        const dateTime = request.cancellationRequestType === 'RESCHEDULE' && request.requestedDate
            ? `Khung giờ đề xuất: ${request.requestedDate.toLocaleDateString('vi-VN')} ${request.requestedStartTime}-${request.requestedEndTime}.`
            : '';
        const submitted = event === 'SUBMITTED';
        const subject = submitted ? `Khách gửi yêu cầu ${typeLabel}` : `Yêu cầu ${typeLabel} đã được xử lý`;
        const text = `Khách ${request.name} gửi yêu cầu ${typeLabel} cho ${venue?.name || 'cơ sở'}${court ? ` - ${court.name}` : ''}, lịch ${request.startTime}-${request.endTime} ngày ${request.date.toLocaleDateString('vi-VN')}. ${dateTime} Lý do: ${request.cancellationRequestReason || 'Không có'}.`;
        const key = `booking-request:${request.id}:change:${request.cancellationRequestType}:${request.cancellationRequestedAt?.getTime() || 'legacy'}`;
        if (request.customerId) {
            await this.enqueue({
                customerId: request.customerId,
                dedupeKey: `${key}:customer:${event}`,
                subject,
                text: submitted ? `Bạn đã gửi yêu cầu ${typeLabel}. ${dateTime} Cơ sở sẽ xử lý; lịch hiện tại vẫn giữ nguyên đến khi được duyệt.` : `Cơ sở đã ${event === 'APPROVED' ? 'duyệt' : 'từ chối'} yêu cầu ${typeLabel} của bạn. ${dateTime}`,
            });
        }
        if (submitted) {
            const [assignedStaff, admins] = await Promise.all([
                prisma.venueStaff.findMany({ where: { venueId: request.venueId }, include: { user: { select: { email: true } } } }),
                prisma.user.findMany({ where: { isActive: true, role: { in: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] } }, select: { email: true } }),
            ]);
            const emails = new Set([
                ...assignedStaff.map((staff) => staff.user.email),
                ...admins.map((admin) => admin.email),
            ].filter(Boolean));
            await Promise.all([...emails].map((email) => this.enqueue({
                email,
                dedupeKey: `${key}:admin:${email.toLowerCase()}`,
                subject,
                text,
            })));
        }
    }

    async upcomingBooking(booking: {
        id: string; customerId: string | null; date: Date; startTime: string; endTime: string;
        court: { name: string; venueId: string };
    }) {
        const customer = booking.customerId
            ? await prisma.customer.findUnique({ where: { id: booking.customerId }, select: { email: true, name: true } })
            : null;
        if (!customer?.email) return;
        const venue = await prisma.venue.findUnique({ where: { id: booking.court.venueId }, select: { name: true } });
        const reminderAt = new Date(
            new Date(booking.date).getTime() + timeToMilliseconds(booking.startTime) - 24 * 60 * 60_000,
        );
        if (reminderAt <= new Date()) return;
        await this.enqueue({
            email: customer.email,
            dedupeKey: `booking:${booking.id}:reminder:24h`,
            subject: 'Nhắc lịch đặt sân ngày mai',
            scheduledAt: reminderAt,
            text: `Chào ${customer.name}, bạn có lịch tại ${venue?.name || 'cơ sở'} - ${booking.court.name} vào ${booking.startTime}-${booking.endTime}, ngày ${booking.date.toLocaleDateString('vi-VN')}. Hẹn gặp bạn!`,
        });
    }

    async runDue() {
        if (this.processing) return;
        this.processing = true;
        try {
            const now = new Date();
            await prisma.emailNotification.updateMany({
                where: { status: 'PROCESSING', lockedAt: { lt: new Date(now.getTime() - 5 * 60_000) } },
                data: { status: 'PENDING', lockedAt: null },
            });
            const due = await prisma.emailNotification.findMany({
                where: { status: 'PENDING', nextAttemptAt: { lte: now } },
                orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
                take: 20,
            });
            for (const notification of due) {
                const claim = await prisma.emailNotification.updateMany({
                    where: { id: notification.id, status: 'PENDING' },
                    data: { status: 'PROCESSING', lockedAt: now },
                });
                if (claim.count !== 1) continue;
                try {
                    await mailService.sendNotification(
                        notification.toEmail,
                        notification.subject,
                        notification.text,
                        notification.html,
                    );
                    await prisma.emailNotification.update({
                        where: { id: notification.id },
                        data: { status: 'SENT', sentAt: new Date(), lockedAt: null, lastError: null },
                    });
                } catch (error) {
                    const attempts = notification.attempts + 1;
                    const backoffMinutes = Math.min(60, 2 ** Math.min(attempts, 6));
                    console.error('Gửi email thông báo thất bại; sẽ thử lại:', error instanceof Error ? error.message : error);
                    await prisma.emailNotification.update({
                        where: { id: notification.id },
                        data: {
                            status: attempts >= 10 ? 'FAILED' : 'PENDING',
                            attempts,
                            lockedAt: null,
                            nextAttemptAt: new Date(Date.now() + backoffMinutes * 60_000),
                            lastError: error instanceof Error ? error.message.slice(0, 500) : 'Lỗi SMTP không xác định',
                        },
                    });
                }
            }
        } catch (error) {
            console.error('Không thể xử lý hàng đợi email:', error instanceof Error ? error.message : error);
        } finally {
            this.processing = false;
        }
    }
}

function timeToMilliseconds(time: string) {
    const [hours, minutes] = time.split(':').map(Number);
    return (hours * 60 + minutes) * 60_000;
}

export const notificationService = new NotificationService();

export async function safelyQueueNotification(task: Promise<void>, label: string) {
    try {
        await task;
    } catch (error) {
        console.error(`Không thể đưa thông báo ${label} vào hàng đợi:`, error instanceof Error ? error.message : error);
    }
}
