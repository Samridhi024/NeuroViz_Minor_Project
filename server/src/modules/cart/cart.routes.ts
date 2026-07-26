import { Router } from 'express';
import { cartController } from './cart.controller.js';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { addToCartSchema, updateCartItemSchema } from './cart.schema.js';

const router = Router();

router.use(authenticate); // All cart routes require auth

router.get('/', cartController.getCart);
router.post('/items', validate({ body: addToCartSchema }), cartController.addItem);
router.patch('/items/:id', validate({ body: updateCartItemSchema }), cartController.updateItem);
router.delete('/items/:id', cartController.removeItem);

export default router;
