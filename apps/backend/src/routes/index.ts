import { Router } from 'express';
import authRoutes from './auth.routes.js';
import venueRoutes from './venue.routes.js';
import courtRoutes from './court.routes.js';
import bookingRoutes from './booking.routes.js';
import customerRoutes from './customer.routes.js';
import invoiceRoutes from './invoice.routes.js';
import productRoutes from './product.routes.js';
import serviceRoutes from './service.routes.js';
import pricingRuleRoutes from './pricing-rule.routes.js';
import reportRoutes from './report.routes.js';
import exportRoutes from './export.routes.js';
import recurringBookingRoutes from './recurring-booking.routes.js';
import chatbotRoutes from './chatbot.routes.js';
import zaloRoutes from './zalo.routes.js';
import bookingRequestRoutes from './booking-request.routes.js';
import exploreContentRoutes from './explore-content.routes.js';
import operatingHourRoutes from './operating-hour.routes.js';
import voucherRoutes from './voucher.routes.js';

const router = Router();

// Health check
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Courtify API is running',
        timestamp: new Date().toISOString(),
    });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/venues', venueRoutes);
router.use('/courts', courtRoutes);
router.use('/bookings', bookingRoutes);
router.use('/booking-requests', bookingRequestRoutes);
router.use('/recurring-bookings', recurringBookingRoutes);
router.use('/customers', customerRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/products', productRoutes);
router.use('/services', serviceRoutes);
router.use('/pricing-rules', pricingRuleRoutes);
router.use('/operating-hours', operatingHourRoutes);
router.use('/vouchers', voucherRoutes);
router.use('/reports', reportRoutes);
router.use('/export', exportRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/zalo', zaloRoutes);
router.use('/explore-contents', exploreContentRoutes);
import momoRoutes from './momo.routes.js';
import vnpayRoutes from './vnpay.routes.js';
import portalAuthRoutes from './portal-auth.routes.js';
router.use('/portal-auth', portalAuthRoutes);
router.use('/momo', momoRoutes);
router.use('/vnpay', vnpayRoutes);

export default router;
