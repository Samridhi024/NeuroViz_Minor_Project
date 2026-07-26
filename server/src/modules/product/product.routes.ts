import { Router } from 'express';
import { productController } from './product.controller.js';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/rbac.js';
import { createProductSchema, updateProductSchema, productListQuerySchema } from './product.schema.js';

const router = Router();

router.get('/', validate({ query: productListQuerySchema }), productController.list);
router.get('/:id', productController.getById);
router.post('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), validate({ body: createProductSchema }), productController.create);
router.patch('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), validate({ body: updateProductSchema }), productController.update);
router.delete('/:id', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), productController.delete);

export default router;
