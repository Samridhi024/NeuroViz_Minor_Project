import { CreateNotificationInput } from './notification.types.js';

export class NotificationService {
  async list(userId: string, query: any) {
    // TODO: List notifications with pagination
    throw new Error('Not implemented');
  }

  async markAsRead(notificationId: string, userId: string) {
    // TODO: Mark notification as read
    throw new Error('Not implemented');
  }

  async markAllAsRead(userId: string) {
    // TODO: Mark all notifications as read
    throw new Error('Not implemented');
  }

  async send(input: CreateNotificationInput) {
    // TODO: Create notification record + send FCM push notification
    throw new Error('Not implemented');
  }
}

export const notificationService = new NotificationService();
