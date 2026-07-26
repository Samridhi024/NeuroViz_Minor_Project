import { Router } from 'express';
import { adminController } from './admin.controller.js';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/rbac.js';
import { authLimiter } from '../../middleware/rateLimiter.js';
import { adminLoginSchema, kycActionSchema, auditLogQuerySchema } from './admin.schema.js';

const router = Router();

router.post('/login', authLimiter, validate({ body: adminLoginSchema }), adminController.login);

// Protected admin routes
router.use(authenticate);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

router.get('/dashboard', adminController.getDashboard);
router.get('/delivery-partners', adminController.listDeliveryPartners);
router.patch('/delivery-partners/:id/kyc', validate({ body: kycActionSchema }), adminController.handleKyc);
router.get('/audit-logs', validate({ query: auditLogQuerySchema }), adminController.getAuditLogs);

export default router;
