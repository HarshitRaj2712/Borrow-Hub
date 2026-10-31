import mongoose from 'mongoose'

const verificationRequestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  documentPublicId: { type: String, required: true },
  selfiePublicId: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reviewedBy: { type: String, default: '' },
  reviewedAt: { type: Date },
  rejectionReason: { type: String, default: '' }
}, { timestamps: true, versionKey: false })

verificationRequestSchema.index({ userId: 1, status: 1 })

export const VerificationRequest = mongoose.models.VerificationRequest || mongoose.model('VerificationRequest', verificationRequestSchema)
