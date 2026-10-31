import mongoose from 'mongoose'

const reviewSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  bookingId: { type: String, required: true, index: true },
  reviewerId: { type: String, required: true, index: true },
  revieweeId: { type: String, required: true, index: true },
  itemId: { type: String, required: true, index: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  body: { type: String, trim: true, maxlength: 1000, default: '' }
}, { timestamps: true, versionKey: false })

reviewSchema.index({ bookingId: 1, reviewerId: 1 }, { unique: true })

export const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema)
