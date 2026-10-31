import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  type: { type: String, required: true },
  message: { type: String, required: true, maxlength: 500 },
  readAt: { type: Date },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true, versionKey: false })

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 })

export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema)
