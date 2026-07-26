import { Router } from 'express';
import { inventoryController } from './inventory.controller.js';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/rbac.js';
import { createBatchSchema, extendBatchSchema } from './inventory.schema.js';

const router = Router();

router.get('/batches', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), inventoryController.listBatches);
router.post('/batches', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), validate({ body: createBatchSchema }), inventoryController.createBatch);
router.patch('/batches/:id/extend', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), validate({ body: extendBatchSchema }), inventoryController.extendBatch);
router.patch('/batches/:id/perish', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), inventoryController.markPerished);

export default router;
