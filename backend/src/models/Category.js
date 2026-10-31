import mongoose from 'mongoose'

const categorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  subcategories: { type: [String], default: [] },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true, versionKey: false })

export const Category = mongoose.models.Category || mongoose.model('Category', categorySchema)
