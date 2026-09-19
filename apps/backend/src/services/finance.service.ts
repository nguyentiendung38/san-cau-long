import prisma from '../config/database.js';
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, format } from 'date-fns';

export interface FinanceDashboardStats {
    // Doanh thu
    revenue: number;
    revenueGrowth: number;  // % so kỳ trước
    // Đơn hàng
    orderCount: number;
    orderCountGrowth: number;
    // Chi phí
    totalExpense: number;
    expenseGrowth: number;
    // Lợi nhuận
    netProfit: number;
    profitGrowth: number;
    // Pending
    pendingOrders: number;
}

export interface FinanceRevenueChartData {
    date: string;
    revenue: number;
    expense: number;
    profit: number;
    orders: number;
}

export interface FinanceExpenseBreakdown {
    category: string;
    label: string;
    amount: number;
    color: string;
}

export interface RecentOrder {
    id: string;
    orderCode: string;
    customerName: string;
    productName: string;
    quantity: number;
    grossRevenue: number;
    netProfit: number;
    status: string;
    paymentMethod: string | null;
    createdAt: Date;
}

const EXPENSE_LABELS: Record<string, string> = {
    ADS: 'Quảng cáo',
    SHIPPING: 'Vận chuyển',
    COMMISSION: 'Hoa hồng TikTok',
    IMPORT: 'Nhập hàng',
    PACKAGING: 'Đóng gói',
    SALARY: 'Nhân sự',
    PLATFORM: 'Phí sàn',
    OTHER: 'Khác',
};

const EXPENSE_COLORS: Record<string, string> = {
    ADS: '#f59e0b',
    SHIPPING: '#6366f1',
    COMMISSION: '#ef4444',
    IMPORT: '#10b981',
    PACKAGING: '#3b82f6',
    SALARY: '#8b5cf6',
    PLATFORM: '#ec4899',
    OTHER: '#6b7280',
};

export class FinanceService {
    /**
     * Lấy thống kê dashboard tài chính theo kỳ
     * period: 'day' | 'week' | 'month'
     */
    async getDashboardStats(period: 'day' | 'week' | 'month' = 'month'): Promise<FinanceDashboardStats> {
        const now = new Date();
        let startCurrent: Date;
        let endCurrent: Date;
        let startPrev: Date;
        let endPrev: Date;

        switch (period) {
            case 'day':
                startCurrent = startOfDay(now);
                endCurrent = endOfDay(now);
                startPrev = startOfDay(subDays(now, 1));
                endPrev = endOfDay(subDays(now, 1));
                break;
            case 'week':
                startCurrent = startOfDay(subDays(now, 6));
                endCurrent = endOfDay(now);
                startPrev = startOfDay(subDays(now, 13));
                endPrev = endOfDay(subDays(now, 7));
                break;
            case 'month':
            default:
                startCurrent = startOfMonth(now);
                endCurrent = endOfMonth(now);
                const prevMonthDate = subDays(startCurrent, 1);
                startPrev = startOfMonth(prevMonthDate);
                endPrev = endOfMonth(prevMonthDate);
                break;
        }

        const dateFilter = { gte: startCurrent, lte: endCurrent };
        const prevDateFilter = { gte: startPrev, lte: endPrev };

        // Revenue hiện tại
        const [currentRevenue, prevRevenue] = await Promise.all([
            prisma.tikOrder.aggregate({
                where: { createdAt: dateFilter, status: { notIn: ['CANCELLED', 'RETURNED'] } },
                _sum: { grossRevenue: true },
            }),
            prisma.tikOrder.aggregate({
                where: { createdAt: prevDateFilter, status: { notIn: ['CANCELLED', 'RETURNED'] } },
                _sum: { grossRevenue: true },
            }),
        ]);

        // Order count
        const [currentOrders, prevOrders] = await Promise.all([
            prisma.tikOrder.count({
                where: { createdAt: dateFilter, status: { notIn: ['CANCELLED', 'RETURNED'] } },
            }),
            prisma.tikOrder.count({
                where: { createdAt: prevDateFilter, status: { notIn: ['CANCELLED', 'RETURNED'] } },
            }),
        ]);

        // Expenses
        const [currentExpense, prevExpense] = await Promise.all([
            prisma.tikExpense.aggregate({
                where: { expenseDate: dateFilter, isPaid: true },
                _sum: { amount: true },
            }),
            prisma.tikExpense.aggregate({
                where: { expenseDate: prevDateFilter, isPaid: true },
                _sum: { amount: true },
            }),
        ]);

        // Net profit
        const [currentProfit, prevProfit] = await Promise.all([
            prisma.tikOrder.aggregate({
                where: { createdAt: dateFilter, status: { notIn: ['CANCELLED', 'RETURNED'] } },
                _sum: { netProfit: true },
            }),
            prisma.tikOrder.aggregate({
                where: { createdAt: prevDateFilter, status: { notIn: ['CANCELLED', 'RETURNED'] } },
                _sum: { netProfit: true },
            }),
        ]);

        // Pending orders
        const pendingOrders = await prisma.tikOrder.count({
            where: { status: { in: ['PENDING', 'PROCESSING'] } },
        });

        const rev = currentRevenue._sum.grossRevenue || 0;
        const prevRev = prevRevenue._sum.grossRevenue || 0;
        const exp = currentExpense._sum.amount || 0;
        const prevExp = prevExpense._sum.amount || 0;
        const profit = currentProfit._sum.netProfit || 0;
        const prevProfit2 = prevProfit._sum.netProfit || 0;

        const calcGrowth = (curr: number, prev: number) =>
            prev > 0 ? Math.round(((curr - prev) / prev) * 100 * 10) / 10 : 0;

        return {
            revenue: rev,
            revenueGrowth: calcGrowth(rev, prevRev),
            orderCount: currentOrders,
            orderCountGrowth: calcGrowth(currentOrders, prevOrders),
            totalExpense: exp,
            expenseGrowth: calcGrowth(exp, prevExp),
            netProfit: profit,
            profitGrowth: calcGrowth(profit, prevProfit2),
            pendingOrders,
        };
    }

    /**
     * Dữ liệu biểu đồ doanh thu theo ngày
     */
    async getRevenueChart(days = 7): Promise<FinanceRevenueChartData[]> {
        const result: FinanceRevenueChartData[] = [];
        const today = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = subDays(today, i);
            const start = startOfDay(date);
            const end = endOfDay(date);

            const [revenue, expense, profitAgg, orderCount] = await Promise.all([
                prisma.tikOrder.aggregate({
                    where: {
                        createdAt: { gte: start, lte: end },
                        status: { notIn: ['CANCELLED', 'RETURNED'] },
                    },
                    _sum: { grossRevenue: true },
                }),
                prisma.tikExpense.aggregate({
                    where: { expenseDate: { gte: start, lte: end }, isPaid: true },
                    _sum: { amount: true },
                }),
                prisma.tikOrder.aggregate({
                    where: {
                        createdAt: { gte: start, lte: end },
                        status: { notIn: ['CANCELLED', 'RETURNED'] },
                    },
                    _sum: { netProfit: true },
                }),
                prisma.tikOrder.count({
                    where: {
                        createdAt: { gte: start, lte: end },
                        status: { notIn: ['CANCELLED', 'RETURNED'] },
                    },
                }),
            ]);

            result.push({
                date: format(date, 'dd/MM'),
                revenue: revenue._sum.grossRevenue || 0,
                expense: expense._sum.amount || 0,
                profit: profitAgg._sum.netProfit || 0,
                orders: orderCount,
            });
        }

        return result;
    }

    /**
     * Phân bổ chi phí theo danh mục
     */
    async getExpenseBreakdown(period: 'day' | 'week' | 'month' = 'month'): Promise<FinanceExpenseBreakdown[]> {
        const now = new Date();
        let start: Date;
        let end: Date;

        switch (period) {
            case 'day':
                start = startOfDay(now);
                end = endOfDay(now);
                break;
            case 'week':
                start = startOfDay(subDays(now, 6));
                end = endOfDay(now);
                break;
            case 'month':
            default:
                start = startOfMonth(now);
                end = endOfMonth(now);
                break;
        }

        const grouped = await prisma.tikExpense.groupBy({
            by: ['category'],
            where: { expenseDate: { gte: start, lte: end }, isPaid: true },
            _sum: { amount: true },
            orderBy: { _sum: { amount: 'desc' } },
        });

        return grouped.map(g => ({
            category: g.category,
            label: EXPENSE_LABELS[g.category] || g.category,
            amount: g._sum.amount || 0,
            color: EXPENSE_COLORS[g.category] || '#6b7280',
        }));
    }

    /**
     * Đơn hàng mới nhất
     */
    async getRecentOrders(limit = 5): Promise<RecentOrder[]> {
        const orders = await prisma.tikOrder.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
        });

        return orders.map(o => ({
            id: o.id,
            orderCode: o.orderCode,
            customerName: o.customerName,
            productName: o.productName,
            quantity: o.quantity,
            grossRevenue: o.grossRevenue,
            netProfit: o.netProfit,
            status: o.status,
            paymentMethod: o.paymentMethod,
            createdAt: o.createdAt,
        }));
    }
}

export const financeService = new FinanceService();
