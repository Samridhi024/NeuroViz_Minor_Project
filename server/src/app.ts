import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import { globalLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './lib/logger.js';

// Module routes
import authRoutes from './modules/auth/auth.routes.js';
import productRoutes from './modules/product/product.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import cartRoutes from './modules/cart/cart.routes.js';
import orderRoutes from './modules/order/order.routes.js';
import deliveryRoutes from './modules/delivery/delivery.routes.js';
import paymentRoutes from './modules/payment/payment.routes.js';
import notificationRoutes from './modules/notification/notification.routes.js';
import offerRoutes from './modules/offer/offer.routes.js';
import pricingRoutes from './modules/pricing/pricing.routes.js';
import refundRoutes from './modules/refund/refund.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import checkoutRoutes from './modules/checkout/checkout.routes.js';

dotenv.config();

const app = express();

// ─── Global Middleware ─────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(globalLimiter);

// ─── Health Check ──────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API Routes ────────────────────────────────────
const API_V1 = '/api/v1';
app.use(`${API_V1}/auth`, authRoutes);
app.use(`${API_V1}/products`, productRoutes);
app.use(`${API_V1}/inventory`, inventoryRoutes);
app.use(`${API_V1}/cart`, cartRoutes);
app.use(`${API_V1}/orders`, orderRoutes);
app.use(`${API_V1}/delivery`, deliveryRoutes);
app.use(`${API_V1}/payments`, paymentRoutes);
app.use(`${API_V1}/notifications`, notificationRoutes);
app.use(`${API_V1}/offers`, offerRoutes);
app.use(`${API_V1}/pricing`, pricingRoutes);
app.use(`${API_V1}/refunds`, refundRoutes);
app.use(`${API_V1}/admin`, adminRoutes);
app.use(`${API_V1}/checkout`, checkoutRoutes);

// ─── 404 Handler ───────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

// ─── Error Handler ─────────────────────────────────
app.use(errorHandler);

logger.info('Express app initialized');

export default app;
