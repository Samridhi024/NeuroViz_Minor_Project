import { Router } from 'express';
import { pricingController } from './pricing.controller.js';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/rbac.js';
import { createPricingRuleSchema, updatePricingRuleSchema } from './pricing.schema.js';

const router = Router();

router.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), pricingController.listRules);
router.post('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), validate({ body: createPricingRuleSchema }), pricingController.createRule);
router.patch('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), validate({ body: updatePricingRuleSchema }), pricingController.updateRule);
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), pricingController.deleteRule);

export default router;
