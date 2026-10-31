import mongoose from 'mongoose'

const availabilitySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  itemId: { type: String, required: true, index: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true }
}, { timestamps: true, versionKey: false })

availabilitySchema.index({ itemId: 1, startDate: 1, endDate: 1 })

export const Availability = mongoose.models.Availability || mongoose.model('Availability', availabilitySchema)
