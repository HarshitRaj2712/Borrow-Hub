import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  phone: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  tokenVersion: { type: Number, default: 0 },
  refreshTokenHash: { type: String, select: false },
  refreshTokenExpiresAt: { type: Date, select: false },
  passwordResetTokenHash: { type: String, select: false },
  passwordResetTokenExpiresAt: { type: Date, select: false },
  role: { type: String, enum: ['member', 'borrower', 'lender', 'admin'], default: 'member', index: true },
  gender: { type: String, enum: ['male', 'female', 'non_binary', 'prefer_not_to_say'], required: true },
  emailVerified: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },
  identityVerified: { type: Boolean, default: false },
  identityVerificationStatus: { type: String, enum: ['not_started', 'pending', 'approved', 'rejected'], default: 'not_started' },
  avatarUrl: { type: String, trim: true, maxlength: 500, default: '' },
  privacySettings: {
    showEmail: { type: Boolean, default: false },
    showPhone: { type: Boolean, default: false },
    showLocation: { type: Boolean, default: true }
  },
  notificationSettings: {
    email: { type: Boolean, default: true },
    bookingUpdates: { type: Boolean, default: true },
    marketing: { type: Boolean, default: false }
  },
  isActive: { type: Boolean, default: true, index: true },
  deactivatedAt: { type: Date },
  phoneOtpHash: { type: String, select: false },
  phoneOtpExpiresAt: { type: Date, select: false },
  phoneOtpAttempts: { type: Number, select: false, default: 0 },
  verificationTokenHash: { type: String, select: false },
  verificationTokenExpiresAt: { type: Date, select: false },
  bio: { type: String, trim: true, maxlength: 500, default: '' },
  location: {
    city: { type: String, trim: true },
    area: { type: String, trim: true }
  }
}, { timestamps: true, versionKey: false })

export const User = mongoose.models.User || mongoose.model('User', userSchema)
