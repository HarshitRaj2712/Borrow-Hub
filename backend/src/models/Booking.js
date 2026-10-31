import mongoose from 'mongoose'

const bookingSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  itemId: { type: String, required: true, index: true },
  itemTitle: { type: String, required: true },
  borrowerId: { type: String, required: true, index: true },
  ownerId: { type: String, required: true, index: true },
  startDate: { type: Date, required: true, index: true },
  endDate: { type: Date, required: true, index: true },
  message: { type: String, trim: true, maxlength: 500, default: '' },
  days: { type: Number, required: true, min: 1 },
  amount: { type: Number, required: true, min: 0 },
  deposit: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Payment Pending', 'Confirmed', 'Active', 'Return Pending', 'Returned', 'Cancelled', 'Overdue', 'Disputed'], default: 'Pending', index: true }
}, { timestamps: true, versionKey: false })

bookingSchema.index({ itemId: 1, startDate: 1, endDate: 1, status: 1 })

export const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema)
