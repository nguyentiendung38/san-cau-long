import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { financeService } from '../services/finance.service.js';

const router = Router();

// GET /finance/dashboard - Dashboard KPI stats
router.get('/dashboard', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const period = (req.query.period as 'day' | 'week' | 'month') || 'month';
        const stats = await financeService.getDashboardStats(period);
        res.json({ success: true, data: stats });
    } catch (error) {
        next(error);
    }
});

// GET /finance/revenue-chart - Revenue chart data
router.get('/revenue-chart', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const days = req.query.days ? parseInt(req.query.days as string) : 7;
        const data = await financeService.getRevenueChart(days);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

// GET /finance/expense-breakdown - Expense breakdown by category
router.get('/expense-breakdown', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const period = (req.query.period as 'day' | 'week' | 'month') || 'month';
        const data = await financeService.getExpenseBreakdown(period);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

// GET /finance/recent-orders - Recent orders for dashboard
router.get('/recent-orders', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
        const data = await financeService.getRecentOrders(limit);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

export default router;
