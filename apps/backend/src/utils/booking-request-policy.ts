import { timeToMinutes } from './booking-rules.js';

export const BANK_TRANSFER_HOLD_DURATION_MS = 30 * 60_000;

export function getBankTransferExpiry(createdAt: Date): Date {
    return new Date(createdAt.getTime() + BANK_TRANSFER_HOLD_DURATION_MS);
}

export function isBookingStartInFuture(date: Date, startTime: string, now = new Date()): boolean {
    if (Number.isNaN(date.getTime())) return false;

    const nowParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(now);
    const parts = Object.fromEntries(nowParts.map(({ type, value }) => [type, value]));
    const bookingDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const today = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
    if (bookingDay !== today) return bookingDay > today;

    const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);
    const startMinutes = timeToMinutes(startTime);
    return startMinutes !== null && startMinutes > currentMinutes;
}

export function isChangeRequestBeforeDeadline(date: Date, startTime: string, now = new Date()): boolean {
    const [hours, minutes] = startTime.split(':').map(Number);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return false;
    const startUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes) - 7 * 60 * 60_000;
    return startUtc - now.getTime() >= 24 * 60 * 60_000;
}
