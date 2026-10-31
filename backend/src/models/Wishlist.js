import mongoose from 'mongoose'

const wishlistSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  itemId: { type: String, required: true, index: true }
}, { timestamps: true, versionKey: false })

wishlistSchema.index({ userId: 1, itemId: 1 }, { unique: true })

export const Wishlist = mongoose.models.Wishlist || mongoose.model('Wishlist', wishlistSchema)
