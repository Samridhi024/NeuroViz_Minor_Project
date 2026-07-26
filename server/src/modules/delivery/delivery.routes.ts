import { Router } from 'express';
import { deliveryController } from './delivery.controller.js';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/rbac.js';
import { acceptOrderSchema, locationUpdateSchema } from './delivery.schema.js';

const router = Router();

router.get('/available', authenticate, authorize('DELIVERY_PARTNER'), deliveryController.getAvailableOrders);
router.post('/accept', authenticate, authorize('DELIVERY_PARTNER'), validate({ body: acceptOrderSchema }), deliveryController.acceptOrder);
router.patch('/location', authenticate, authorize('DELIVERY_PARTNER'), validate({ body: locationUpdateSchema }), deliveryController.updateLocation);
router.get('/:id/track', authenticate, deliveryController.getTracking);
router.patch('/:id/complete', authenticate, authorize('DELIVERY_PARTNER'), deliveryController.completeDelivery);

export default router;
