export interface CreateNotificationInput {
  userId: string;
  title: string;
  body: string;
  type: string;
  metadata?: Record<string, any>;
}
