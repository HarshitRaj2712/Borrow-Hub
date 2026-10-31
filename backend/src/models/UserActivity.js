import mongoose from 'mongoose'

const userActivitySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  itemId: { type: String, required: true, index: true },
  type: { type: String, enum: ['view', 'search'], required: true }
}, { timestamps: true, versionKey: false })

export const UserActivity = mongoose.models.UserActivity || mongoose.model('UserActivity', userActivitySchema)
