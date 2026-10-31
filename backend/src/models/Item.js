import mongoose from 'mongoose'

const itemSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
  category: { type: String, required: true, trim: true, index: true },
  condition: { type: String, enum: ['New', 'Like New', 'Good', 'Fair'], required: true },
  pricePerDay: { type: Number, required: true, min: 0 },
  deposit: { type: Number, required: true, min: 0 },
  location: {
    city: { type: String, required: true, trim: true },
    area: { type: String, required: true, trim: true },
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 }
  },
  ownerId: { type: String, required: true, index: true },
  ownerName: { type: String, required: true },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  available: { type: Boolean, default: true, index: true }
}, { timestamps: true, versionKey: false })

export const Item = mongoose.models.Item || mongoose.model('Item', itemSchema)
