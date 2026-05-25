import { Request, Response } from 'express';
import { notificationService } from '../../lib/notifications.service';

export class NotificationsController {
  getNotifications = async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const notifications = await notificationService.getNotifications(userId);
    const unreadCount = await notificationService.getUnreadCount(userId);
    
    return res.json({
      success: true,
      data: {
        notifications,
        unreadCount
      }
    });
  };

  markRead = async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const { id } = req.params;
    await notificationService.markRead(userId, id);
    return res.json({ success: true });
  };

  markAllRead = async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    await notificationService.markAllRead(userId);
    return res.json({ success: true });
  };

  clearAll = async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    await notificationService.clearAll(userId);
    return res.json({ success: true });
  };
}

export const notificationsController = new NotificationsController();
export default notificationsController;
