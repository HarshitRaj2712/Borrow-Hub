import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  phone: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['member', 'borrower', 'lender', 'admin'], default: 'member', index: true },
  gender: { type: String, enum: ['male', 'female', 'non_binary', 'prefer_not_to_say'], required: true },
  verified: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  verificationTokenHash: { type: String, select: false },
  verificationTokenExpiresAt: { type: Date, select: false },
  bio: { type: String, trim: true, maxlength: 500, default: '' },
  location: {
    city: { type: String, trim: true },
    area: { type: String, trim: true }
  }
}, { timestamps: true, versionKey: false })

export const User = mongoose.models.User || mongoose.model('User', userSchema)
