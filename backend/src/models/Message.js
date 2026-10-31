import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  conversationId: { type: String, required: true, index: true },
  senderId: { type: String, required: true, index: true },
  body: { type: String, required: true, trim: true, maxlength: 2000 },
  readAt: { type: Date }
}, { timestamps: true, versionKey: false })

messageSchema.index({ conversationId: 1, createdAt: -1 })

export const Message = mongoose.models.Message || mongoose.model('Message', messageSchema)
