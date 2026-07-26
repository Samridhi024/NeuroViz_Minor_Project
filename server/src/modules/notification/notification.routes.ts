import { Router } from 'express';
import { notificationController } from './notification.controller.js';
import { validate } from '../../middleware/validator.js';
import { authenticate } from '../../middleware/auth.js';
import { notificationListQuerySchema } from './notification.schema.js';

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: notificationListQuerySchema }), notificationController.list);
router.patch('/:id/read', notificationController.markAsRead);
router.patch('/read-all', notificationController.markAllAsRead);

export default router;
