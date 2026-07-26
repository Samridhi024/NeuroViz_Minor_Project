import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { otpLimiter, authLimiter } from '../../middleware/rateLimiter.js';
import { sendOtpSchema, verifyOtpSchema, refreshTokenSchema } from './auth.schema.js';

const router = Router();

router.post('/otp/send', otpLimiter, validate({ body: sendOtpSchema }), authController.sendOtp);
router.post('/otp/verify', authLimiter, validate({ body: verifyOtpSchema }), authController.verifyOtp);
router.post('/refresh', validate({ body: refreshTokenSchema }), authController.refreshToken);
router.post('/logout', authenticate, authController.logout);

export default router;
