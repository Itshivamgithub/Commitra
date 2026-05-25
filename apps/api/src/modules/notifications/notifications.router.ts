import { Router } from 'express';
import { notificationsController } from './notifications.controller';
import { requireAuth } from '../../middleware/auth';
import { tryCatch } from '../../lib/tryCatch';

const router = Router();

router.use(requireAuth);

router.get('/', tryCatch(notificationsController.getNotifications));
router.patch('/read-all', tryCatch(notificationsController.markAllRead));
router.patch('/:id/read', tryCatch(notificationsController.markRead));
router.delete('/', tryCatch(notificationsController.clearAll));

export default router;
