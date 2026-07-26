import { Router } from 'express';
import { refundController } from './refund.controller.js';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/rbac.js';
import { createRefundSchema, resolveRefundSchema } from './refund.schema.js';

const router = Router();

router.use(authenticate);

router.post('/', validate({ body: createRefundSchema }), refundController.create);
router.get('/mine', refundController.listByUser);
router.get('/', authorize('ADMIN', 'SUPER_ADMIN'), refundController.listAll);
router.patch('/:id', authorize('ADMIN', 'SUPER_ADMIN'), validate({ body: resolveRefundSchema }), refundController.resolve);

export default router;
