import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, sendNotificationMock } = vi.hoisted(() => ({
    prismaMock: {
        emailNotification: {
            create: vi.fn(),
            updateMany: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
        },
        customer: { findUnique: vi.fn() },
        venue: { findUnique: vi.fn() },
        court: { findUnique: vi.fn() },
    },
    sendNotificationMock: vi.fn(),
}));

vi.mock('../config/database.js', () => ({ default: prismaMock }));
vi.mock('./mail.service.js', () => ({ mailService: { sendNotification: sendNotificationMock } }));

import { notificationService } from './notification.service.js';

describe('durable email notification delivery', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not queue the same notification twice', async () => {
        prismaMock.customer.findUnique.mockResolvedValue({ email: 'customer@example.com' });
        prismaMock.emailNotification.create.mockRejectedValue({ code: 'P2002' });

        await expect(notificationService.enqueue({
            customerId: 'customer-1',
            dedupeKey: 'booking-1:decision:APPROVED',
            subject: 'Confirmed',
            text: 'Your booking is confirmed',
        })).resolves.toBeUndefined();
        expect(prismaMock.emailNotification.create).toHaveBeenCalledTimes(1);
    });

    it('marks delivered messages as sent after claiming a durable row', async () => {
        prismaMock.emailNotification.updateMany
            .mockResolvedValueOnce({ count: 0 })
            .mockResolvedValueOnce({ count: 1 });
        prismaMock.emailNotification.findMany.mockResolvedValue([{
            id: 'email-1',
            toEmail: 'customer@example.com',
            subject: 'Reminder',
            text: 'Your booking is tomorrow',
            html: '<p>Your booking is tomorrow</p>',
            attempts: 0,
        }]);
        sendNotificationMock.mockResolvedValue(undefined);

        await notificationService.runDue();

        expect(sendNotificationMock).toHaveBeenCalledWith(
            'customer@example.com',
            'Reminder',
            'Your booking is tomorrow',
            '<p>Your booking is tomorrow</p>',
        );
        expect(prismaMock.emailNotification.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'email-1' },
            data: expect.objectContaining({ status: 'SENT' }),
        }));
    });

    it('persists delivery failures for retry without throwing into booking operations', async () => {
        prismaMock.emailNotification.updateMany
            .mockResolvedValueOnce({ count: 0 })
            .mockResolvedValueOnce({ count: 1 });
        prismaMock.emailNotification.findMany.mockResolvedValue([{
            id: 'email-2',
            toEmail: 'customer@example.com',
            subject: 'Reminder',
            text: 'Your booking is tomorrow',
            html: '<p>Your booking is tomorrow</p>',
            attempts: 0,
        }]);
        sendNotificationMock.mockRejectedValue(new Error('SMTP unavailable'));
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        await expect(notificationService.runDue()).resolves.toBeUndefined();
        expect(prismaMock.emailNotification.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'email-2' },
            data: expect.objectContaining({
                status: 'PENDING',
                attempts: 1,
                lastError: 'SMTP unavailable',
            }),
        }));
        consoleError.mockRestore();
    });
});
