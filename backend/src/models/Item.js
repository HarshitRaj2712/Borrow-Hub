import mongoose from 'mongoose'

const itemSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
  category: { type: String, required: true, trim: true, index: true },
  subcategory: { type: String, trim: true, index: true, default: '' },
  condition: { type: String, enum: ['New', 'Like New', 'Good', 'Fair'], required: true },
  pricePerDay: { type: Number, required: true, min: 0 },
  deposit: { type: Number, required: true, min: 0 },
  minBorrowDays: { type: Number, min: 1, default: 1 },
  maxBorrowDays: { type: Number, min: 1, default: 30 },
  images: [{ url: { type: String, required: true }, publicId: { type: String, required: true } }],
  location: {
    city: { type: String, required: true, trim: true },
    area: { type: String, required: true, trim: true },
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
    coordinates: { type: [Number], index: '2dsphere' }
  },
  ownerId: { type: String, required: true, index: true },
  ownerName: { type: String, required: true },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  status: { type: String, enum: ['active', 'inactive', 'flagged', 'suspended'], default: 'active', index: true },
  borrowCount: { type: Number, default: 0, index: true },
  viewCount: { type: Number, default: 0, index: true },
  available: { type: Boolean, default: true, index: true },
  isActive: { type: Boolean, default: true, index: true },
  deletedAt: { type: Date, index: true },
  bookingVersion: { type: Number, default: 0 }
}, { timestamps: true, versionKey: false })

itemSchema.index({ title: 'text', description: 'text', category: 'text' })

export const Item = mongoose.models.Item || mongoose.model('Item', itemSchema)
