import { AppError } from '../middleware/error.js';

export interface OperatingHourRange {
    startTime: string;
    endTime: string;
    daysOfWeek: string;
    isActive: boolean;
}

export function parseDaysOfWeek(daysOfWeek: string): number[] {
    try {
        const parsed: unknown = JSON.parse(daysOfWeek);
        if (
            Array.isArray(parsed) &&
            parsed.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        ) {
            return [...new Set(parsed as number[])];
        }
    } catch {
        return [];
    }

    return [];
}

export function timeToMinutes(time: string): number | null {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

export function validateOperatingHourRange(
    startTime: string,
    endTime: string,
    daysOfWeek: string,
): number[] {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    const days = parseDaysOfWeek(daysOfWeek);

    if (start === null || end === null || start >= end) {
        throw new AppError(400, 'Giờ kết thúc phải sau giờ bắt đầu và dùng định dạng HH:mm hợp lệ');
    }
    if (start % 30 !== 0 || end % 30 !== 0) {
        throw new AppError(400, 'Giờ hoạt động phải theo khung 30 phút');
    }
    if (days.length === 0) {
        throw new AppError(400, 'Vui lòng chọn ít nhất một ngày hoạt động');
    }

    return days;
}

export function isWithinOperatingHours(
    operatingHours: OperatingHourRange[],
    dayOfWeek: number,
    startTime: string,
    endTime: string,
): boolean {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    if (start === null || end === null || start >= end) return false;

    const intervals = operatingHours.flatMap((hours) => {
        if (!hours.isActive || !parseDaysOfWeek(hours.daysOfWeek).includes(dayOfWeek)) {
            return [];
        }
        const opensAt = timeToMinutes(hours.startTime);
        const closesAt = timeToMinutes(hours.endTime);
        return opensAt !== null && closesAt !== null && opensAt < closesAt
            ? [{ opensAt, closesAt }]
            : [];
    });
    intervals.sort((a, b) => a.opensAt - b.opensAt);

    let coveredUntil = start;
    for (const interval of intervals) {
        if (interval.closesAt <= coveredUntil) continue;
        if (interval.opensAt > coveredUntil) return false;
        coveredUntil = Math.max(coveredUntil, interval.closesAt);
        if (coveredUntil >= end) return true;
    }

    return false;
}
