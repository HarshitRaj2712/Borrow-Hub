import mongoose from 'mongoose'

const conversationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  bookingId: { type: String, required: true, unique: true, index: true },
  borrowerId: { type: String, required: true, index: true },
  ownerId: { type: String, required: true, index: true },
  lastMessageAt: { type: Date },
  unreadBy: { type: Map, of: Number, default: {} }
}, { timestamps: true, versionKey: false })

export const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema)
