import mongoose from 'mongoose'

const disputeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  bookingId: { type: String, required: true, unique: true, index: true },
  openedBy: { type: String, required: true },
  reason: { type: String, required: true, maxlength: 2000 },
  evidence: { type: [String], default: [] },
  status: { type: String, enum: ['open', 'investigating', 'resolved', 'dismissed'], default: 'open', index: true },
  decision: { type: String, default: '' },
  resolvedBy: { type: String, default: '' },
  resolvedAt: { type: Date }
}, { timestamps: true, versionKey: false })

export const Dispute = mongoose.models.Dispute || mongoose.model('Dispute', disputeSchema)
