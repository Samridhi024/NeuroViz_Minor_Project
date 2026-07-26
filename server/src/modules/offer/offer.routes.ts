import { Router } from 'express';
import { offerController } from './offer.controller.js';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/rbac.js';
import { createOfferSchema, updateOfferSchema } from './offer.schema.js';

const router = Router();

router.get('/', offerController.listActive); // Public
router.get('/all', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), offerController.listAll);
router.post('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), validate({ body: createOfferSchema }), offerController.create);
router.patch('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), validate({ body: updateOfferSchema }), offerController.update);
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), offerController.delete);

export default router;
