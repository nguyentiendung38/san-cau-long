import prisma from '../config/database.js';
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, format } from 'date-fns';
import { calculateCollectedInvoiceRevenue } from '../utils/invoice-revenue.js';
import { AppError } from '../middleware/error.js';

export interface DashboardStats {
    todayRevenue: number;
    todayBookings: number;
    activeCustomers: number;
    courtsAvailable: number;
    courtsInUse: number;
    pendingInvoices: number;
    bookingDistribution: { label: string; value: number; color: string }[];
    alerts: {
        pendingRequests: number;
        pendingTransfers: number;
        pendingCancellations: number;
        upcomingBookingsCount: number;
        lowStockCount: number;
        courtsAvailable: number;
    };
}

export interface RevenueChartData {
    date: string;
    revenue: number;
    bookings: number;
}

export interface TopCustomer {
    id: string;
    name: string;
    phone: string;
    membershipTier?: string;
    totalSpent: number;
    totalBookings: number;
}

export interface BookingStatusSummary {
    status: string;
    count: number;
}

function invoiceDateFilter(start: Date, end: Date) {
    return {
        OR: [
            { paidAt: { gte: start, lte: end } },
            { paidAt: null, createdAt: { gte: start, lte: end } },
        ],
    };
}

async function getCollectedRevenue(start: Date, end: Date) {
    const dateFilter = invoiceDateFilter(start, end);
    const [paidInvoices, partialInvoices] = await Promise.all([
        prisma.invoice.aggregate({
            where: { paymentStatus: 'PAID', ...dateFilter },
            _sum: { total: true },
        }),
        prisma.invoice.aggregate({
            where: { paymentStatus: 'PARTIAL', ...dateFilter },
            _sum: { paidAmount: true, depositAmount: true },
        }),
    ]);

    return calculateCollectedInvoiceRevenue(
        paidInvoices._sum.total,
        partialInvoices._sum.paidAmount,
        partialInvoices._sum.depositAmount,
    );
}

export class ReportService {
    async getDashboardStats(period: 'day' | 'week' | 'month' = 'day', venueId?: string): Promise<DashboardStats> {
        const today = new Date();
        let startOfPeriod;
        let endOfPeriod = endOfDay(today);
        if (period === 'month') {
            startOfPeriod = startOfDay(subDays(today, 29));
        } else if (period === 'week') {
            startOfPeriod = startOfDay(subDays(today, 6));
        } else {
            startOfPeriod = startOfDay(today);
        }

        // Get current hour for court availability
        const currentHour = today.getHours();
        const currentMinute = today.getMinutes();
        const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
        const upcomingWindowTime = `${String(Math.min(currentHour + 1, 23)).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

        // Base court filter if venueId is provided
        const courtFilter = venueId ? { court: { venueId } } : {};
        const venueCourtFilter = venueId ? { venueId } : {};

        const collectedRevenue = await getCollectedRevenue(startOfPeriod, endOfPeriod);

        // Count bookings in period
        const periodBookings = await prisma.booking.findMany({
            where: {
                date: {
                    gte: startOfPeriod,
                    lte: endOfPeriod,
                },
                status: { not: 'CANCELLED' },
                ...courtFilter,
            },
            select: {
                id: true,
                startTime: true,
                endTime: true,
                status: true,
            },
        });

        // Calculate REAL booking distribution by time slot
        let morningCount = 0;
        let afternoonCount = 0;
        let eveningCount = 0;

        for (const b of periodBookings) {
            const startH = parseInt(b.startTime.split(':')[0], 10) || 0;
            if (startH < 12) {
                morningCount++;
            } else if (startH < 17) {
                afternoonCount++;
            } else {
                eveningCount++;
            }
        }

        const bookingDistribution = [
            { label: 'Sáng (6-12h)', value: morningCount, color: '#10b981' },
            { label: 'Trưa (12-17h)', value: afternoonCount, color: '#f59e0b' },
            { label: 'Tối (17-23h)', value: eveningCount, color: '#6366f1' },
        ];

        // Count active customers
        const activeCustomers = await prisma.customer.count({
            where: { isActive: true },
        });

        // Count total active courts and courts currently in use
        const totalCourts = await prisma.court.count({
            where: {
                status: { in: ['ACTIVE', 'AVAILABLE'] },
                ...venueCourtFilter,
            },
        });

        // Courts in use right now (today)
        const courtsInUse = await prisma.booking.count({
            where: {
                date: {
                    gte: startOfDay(today),
                    lte: endOfDay(today),
                },
                status: { in: ['IN_PROGRESS', 'CONFIRMED'] },
                startTime: { lte: currentTime },
                endTime: { gt: currentTime },
                ...courtFilter,
            },
        });

        // Pending invoices
        const pendingInvoices = await prisma.invoice.count({
            where: { paymentStatus: 'PENDING' },
        });

        // Operational alerts
        // 1. Pending booking requests
        const pendingRequests = await prisma.bookingRequest.count({
            where: {
                status: 'PENDING',
                ...venueCourtFilter,
            },
        });

        // 2. Pending bank transfer payments needing verification
        const pendingTransfers = await prisma.bookingRequest.count({
            where: {
                paymentMethod: 'DEPOSIT_TRANSFER',
                paymentStatus: 'PENDING',
                ...venueCourtFilter,
            },
        });

        const pendingCancellations = await prisma.bookingRequest.count({
            where: { cancellationRequestStatus: 'PENDING', ...venueCourtFilter },
        });

        // 3. Bookings starting within next 60 minutes
        const upcomingBookingsCount = await prisma.booking.count({
            where: {
                date: {
                    gte: startOfDay(today),
                    lte: endOfDay(today),
                },
                status: { in: ['CONFIRMED', 'PENDING'] },
                startTime: {
                    gte: currentTime,
                    lte: upcomingWindowTime,
                },
                ...courtFilter,
            },
        });

        // 4. Low stock products (stock <= 5)
        const lowStockCount = await prisma.product.count({
            where: {
                isActive: true,
                stock: { lte: 5 },
                ...venueCourtFilter,
            },
        });

        const availableCount = Math.max(0, totalCourts - courtsInUse);

        return {
            todayRevenue: collectedRevenue,
            todayBookings: periodBookings.length,
            activeCustomers,
            courtsAvailable: availableCount,
            courtsInUse,
            pendingInvoices,
            bookingDistribution,
            alerts: {
                pendingRequests,
                pendingTransfers,
                pendingCancellations,
                upcomingBookingsCount,
                lowStockCount,
                courtsAvailable: availableCount,
            },
        };
    }

    async getRevenueChart(days = 7): Promise<RevenueChartData[]> {
        const result: RevenueChartData[] = [];
        const today = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = subDays(today, i);
            const start = startOfDay(date);
            const end = endOfDay(date);

            const [revenue, bookingCount] = await Promise.all([
                getCollectedRevenue(start, end),
                prisma.booking.count({
                    where: {
                        date: { gte: start, lte: end },
                        status: { not: 'CANCELLED' },
                    },
                }),
            ]);

            result.push({
                date: format(date, 'dd/MM'),
                revenue,
                bookings: bookingCount,
            });
        }

        return result;
    }

    async getMonthlyRevenue(): Promise<{ currentMonth: number; lastMonth: number; growth: number }> {
        const today = new Date();
        const startCurrent = startOfMonth(today);
        const endCurrent = endOfMonth(today);

        const lastMonthDate = subDays(startCurrent, 1);
        const startLast = startOfMonth(lastMonthDate);
        const endLast = endOfMonth(lastMonthDate);

        const [currentMonthRevenue, lastMonthRevenue] = await Promise.all([
            getCollectedRevenue(startCurrent, endCurrent),
            getCollectedRevenue(startLast, endLast),
        ]);

        const current = currentMonthRevenue;
        const last = lastMonthRevenue;
        const growth = last > 0 ? ((current - last) / last) * 100 : 0;

        return {
            currentMonth: current,
            lastMonth: last,
            growth: Math.round(growth * 10) / 10,
        };
    }

    async getTopCustomers(limit = 10): Promise<TopCustomer[]> {
        const customers = await prisma.customer.findMany({
            where: { isActive: true, passwordHash: { not: null } },
            orderBy: { totalSpent: 'desc' },
            take: limit,
            select: {
                id: true,
                name: true,
                phone: true,
                membershipTier: true,
                totalSpent: true,
                totalBookings: true,
            },
        });

        return customers.map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            membershipTier: c.membershipTier || undefined,
            totalSpent: c.totalSpent,
            totalBookings: c.totalBookings,
        }));
    }

    async getBookingStatusSummary(venueId?: string): Promise<BookingStatusSummary[]> {
        const today = startOfDay(new Date());

        const where: { date?: { gte: Date }; court?: { venueId: string } } = {
            date: { gte: today },
        };

        if (venueId) {
            where.court = { venueId };
        }

        const bookings = await prisma.booking.groupBy({
            by: ['status'],
            where,
            _count: { id: true },
        });

        return bookings.map(b => ({
            status: b.status,
            count: b._count.id,
        }));
    }

    async getUpcomingBookings(limit = 5): Promise<{
        id: string;
        courtName: string;
        customerName: string;
        date: Date;
        startTime: string;
        endTime: string;
        status: string;
    }[]> {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const bookings = await prisma.booking.findMany({
            where: {
                date: { gte: startOfDay(now) },
                status: { in: ['CONFIRMED', 'PENDING'] },
            },
            orderBy: [
                { date: 'asc' },
                { startTime: 'asc' },
            ],
            take: limit,
            include: {
                court: { select: { name: true } },
                customer: { select: { name: true } },
            },
        });

        return bookings.map(b => ({
            id: b.id,
            courtName: b.court.name,
            customerName: b.customer?.name || 'Khách vãng lai',
            date: b.date,
            startTime: b.startTime,
            endTime: b.endTime,
            status: b.status,
        }));
    }

    async getOccupancyReport(startDate: string, endDate: string, venueId?: string, courtId?: string) {
        const start = new Date(`${startDate}T00:00:00.000Z`);
        const end = new Date(`${endDate}T00:00:00.000Z`);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
            throw new AppError(400, 'Khoảng ngày báo cáo không hợp lệ');
        }
        const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
        if (days > 366) throw new AppError(400, 'Khoảng ngày báo cáo tối đa 366 ngày');

        const courts = await prisma.court.findMany({
            where: {
                status: { in: ['ACTIVE', 'AVAILABLE'] },
                ...(courtId ? { id: courtId } : {}),
                ...(venueId ? { venueId } : {}),
            },
            select: {
                id: true,
                name: true,
                venueId: true,
                venue: {
                    select: {
                        name: true,
                        operatingHours: { where: { isActive: true }, select: { startTime: true, endTime: true, daysOfWeek: true } },
                    },
                },
            },
        });
        const bookings = await prisma.booking.findMany({
            where: {
                date: { gte: start, lt: new Date(end.getTime() + 86_400_000) },
                courtId: { in: courts.map((court) => court.id) },
            },
            select: { courtId: true, date: true, startTime: true, endTime: true, status: true },
        });
        type Bucket = { venueId: string; venueName: string; courtId: string; courtName: string; hour: number; availableMinutes: number; bookedMinutes: number; cancellations: number; noShows: number };
        const buckets = new Map<string, Bucket>();
        const parseMinutes = (value: string) => {
            const [hour, minute] = value.split(':').map(Number);
            return Number.isInteger(hour) && Number.isInteger(minute) ? hour * 60 + minute : null;
        };
        const bookingByDay = new Map<string, typeof bookings>();
        for (const booking of bookings) {
            const key = `${booking.courtId}:${booking.date.toISOString().slice(0, 10)}`;
            bookingByDay.set(key, [...(bookingByDay.get(key) || []), booking]);
        }
        for (const court of courts) {
            for (let day = 0; day < days; day += 1) {
                const date = new Date(start.getTime() + day * 86_400_000);
                const weekday = date.getUTCDay();
                const dayBookings = bookingByDay.get(`${court.id}:${date.toISOString().slice(0, 10)}`) || [];
                for (const hours of court.venue.operatingHours) {
                    let daysOfWeek: number[] = [];
                    try {
                        const parsed: unknown = JSON.parse(hours.daysOfWeek);
                        if (Array.isArray(parsed)) daysOfWeek = parsed.filter((value): value is number => Number.isInteger(value));
                    } catch { /* Ignore malformed legacy operating hours. */ }
                    if (!daysOfWeek.includes(weekday)) continue;
                    const open = parseMinutes(hours.startTime);
                    const close = parseMinutes(hours.endTime);
                    if (open === null || close === null || close <= open) continue;
                    for (let hour = Math.floor(open / 60); hour < Math.ceil(close / 60); hour += 1) {
                        const from = Math.max(open, hour * 60);
                        const to = Math.min(close, (hour + 1) * 60);
                        const key = `${court.id}:${hour}`;
                        const bucket = buckets.get(key) || {
                            venueId: court.venueId, venueName: court.venue.name, courtId: court.id, courtName: court.name,
                            hour, availableMinutes: 0, bookedMinutes: 0, cancellations: 0, noShows: 0,
                        };
                        bucket.availableMinutes += Math.max(0, to - from);
                        for (const booking of dayBookings) {
                            const bookingStart = parseMinutes(booking.startTime);
                            const bookingEnd = parseMinutes(booking.endTime);
                            if (bookingStart === null || bookingEnd === null) continue;
                            if (booking.status === 'CANCELLED' && bookingStart >= from && bookingStart < to) bucket.cancellations += 1;
                            if (booking.status === 'NO_SHOW' && bookingStart >= from && bookingStart < to) bucket.noShows += 1;
                            if (!['CANCELLED', 'NO_SHOW', 'REJECTED'].includes(booking.status)) {
                                bucket.bookedMinutes += Math.max(0, Math.min(to, bookingEnd) - Math.max(from, bookingStart));
                            }
                        }
                        buckets.set(key, bucket);
                    }
                }
            }
        }
        const rows = [...buckets.values()].map((bucket) => ({
            ...bucket,
            availableHours: bucket.availableMinutes / 60,
            bookedHours: bucket.bookedMinutes / 60,
            occupancyRate: bucket.availableMinutes ? Math.round((bucket.bookedMinutes / bucket.availableMinutes) * 100) : 0,
            hourLabel: `${String(bucket.hour).padStart(2, '0')}:00–${String(bucket.hour + 1).padStart(2, '0')}:00`,
        })).sort((a, b) => a.courtName.localeCompare(b.courtName) || a.hour - b.hour);
        const availableMinutes = rows.reduce((sum, row) => sum + row.availableMinutes, 0);
        const bookedMinutes = rows.reduce((sum, row) => sum + row.bookedMinutes, 0);
        return {
            startDate,
            endDate,
            availableHours: availableMinutes / 60,
            bookedHours: bookedMinutes / 60,
            occupancyRate: availableMinutes ? Math.round(bookedMinutes / availableMinutes * 100) : 0,
            cancellations: bookings.filter((booking) => booking.status === 'CANCELLED').length,
            noShows: bookings.filter((booking) => booking.status === 'NO_SHOW').length,
            rows,
            recommendations: rows
                .filter((row) => row.availableHours > 0 && row.occupancyRate < 30)
                .map((row) => ({
                    courtId: row.courtId,
                    courtName: row.courtName,
                    hourLabel: row.hourLabel,
                    occupancyRate: row.occupancyRate,
                    availableHours: row.availableHours,
                    bookedHours: row.bookedHours,
                    suggestion: 'Khung giờ có tỷ lệ lấp đầy thấp; cân nhắc ưu đãi theo giờ để tăng nhu cầu.',
                })),
        };
    }
}

export const reportService = new ReportService();
