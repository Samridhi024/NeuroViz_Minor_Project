import { Router } from 'express';
import { orderController } from './order.controller.js';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/rbac.js';
import { placeOrderSchema, updateOrderStatusSchema, orderListQuerySchema } from './order.schema.js';

const router = Router();

router.use(authenticate);

router.post('/', validate({ body: placeOrderSchema }), orderController.placeOrder);
router.post('/reserve', validate({ body: placeOrderSchema }), orderController.placeOrder);
router.get('/', validate({ query: orderListQuerySchema }), orderController.getOrders);
router.get('/:id', orderController.getOrderById);
router.patch('/:id/status', authorize('ADMIN', 'SUPER_ADMIN', 'DELIVERY_PARTNER'), validate({ body: updateOrderStatusSchema }), orderController.updateStatus);
router.post('/:id/reorder', orderController.reorder);

export default router;
