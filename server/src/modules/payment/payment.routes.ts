import { Router } from 'express';
import { paymentController } from './payment.controller.js';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { initiatePaymentSchema } from './payment.schema.js';

const router = Router();

router.post('/initiate', authenticate, validate({ body: initiatePaymentSchema }), paymentController.initiate);
router.post('/webhook', paymentController.webhook); // No auth — Razorpay calls this
router.get('/:orderId', authenticate, paymentController.getStatus);

export default router;
