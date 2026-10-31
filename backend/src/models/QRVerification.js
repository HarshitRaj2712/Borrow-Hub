import mongoose from 'mongoose'

const qrVerificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  bookingId: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  type: { type: String, enum: ['handover', 'return'], required: true },
  expiresAt: { type: Date, required: true, index: true },
  usedAt: { type: Date }
}, { timestamps: true, versionKey: false })

export const QRVerification = mongoose.models.QRVerification || mongoose.model('QRVerification', qrVerificationSchema)
