import crypto from 'node:crypto'
import { Notification } from '../models/Notification.js'

export async function createNotification(user, type, message, meta = {}) {
  if (!user?.notificationSettings?.bookingUpdates && type.startsWith('booking')) return
  return Notification.create({ id: `notification-${crypto.randomUUID()}`, userId: user.id, type, message, meta })
}
