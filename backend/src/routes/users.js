import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
import { User } from '../models/User.js'
import { Booking } from '../models/Booking.js'
import { requireAuth } from '../middleware/auth.js'
import multer from 'multer'
import { uploadAvatar } from '../services/cloudinary.js'

const router = Router()
const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, callback) => callback(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)) })
const optionalLocationField = z.union([z.string().trim().min(2).max(100), z.literal('')]).optional()
const profileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().min(7).max(20).optional(),
  role: z.enum(['borrower', 'lender']).optional(),
  gender: z.enum(['male', 'female', 'non_binary', 'prefer_not_to_say']).optional(),
  bio: z.string().trim().max(500).optional(),
  avatarUrl: z.string().url().max(500).or(z.literal('')).optional(),
  city: optionalLocationField,
  area: optionalLocationField
}).strict()
const settingsSchema = z.object({
  privacySettings: z.object({ showEmail: z.boolean().optional(), showPhone: z.boolean().optional(), showLocation: z.boolean().optional() }).optional(),
  notificationSettings: z.object({ email: z.boolean().optional(), bookingUpdates: z.boolean().optional(), marketing: z.boolean().optional() }).optional()
}).strict()
const otpSchema = z.object({ code: z.string().regex(/^\d{6}$/) })
const deleteSchema = z.object({ currentPassword: z.string().min(1) })
const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
})

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findOne({ id: req.auth.sub }).lean()
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ data: publicUser(user) })
  } catch (error) { next(error) }
})

router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const input = profileSchema.parse(req.body)
    const user = await User.findOne({ id: req.auth.sub })
    if (!user) return res.status(404).json({ error: 'User not found' })
    const { city, area, ...profileFields } = input
    Object.assign(user, profileFields)
    if (city !== undefined || area !== undefined) {
      const currentLocation = typeof user.location?.toObject === 'function' ? user.location.toObject() : (user.location || {})
      user.location = {
        ...currentLocation,
        ...(city !== undefined ? { city: city || undefined } : {}),
        ...(area !== undefined ? { area: area || undefined } : {})
      }
    }
    await user.save()
    res.json({ data: publicUser(user) })
  } catch (error) { next(error) }
})

router.post('/me/avatar', requireAuth, avatarUpload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'An image file is required (JPEG, PNG, or WebP).' })
    const result = await uploadAvatar(req.file.buffer, req.auth.sub)
    const user = await User.findOneAndUpdate({ id: req.auth.sub }, { avatarUrl: result.secure_url }, { new: true })
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ data: publicUser(user) })
  } catch (error) { next(error) }
})

router.patch('/me/password', requireAuth, async (req, res, next) => {
  try {
    const input = passwordSchema.parse(req.body)
    const user = await User.findOne({ id: req.auth.sub }).select('+passwordHash')
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) return res.status(400).json({ error: 'Current password is incorrect' })
    user.passwordHash = await bcrypt.hash(input.newPassword, 12)
    user.tokenVersion += 1
    user.refreshTokenHash = undefined
    user.refreshTokenExpiresAt = undefined
    await user.save()
    res.status(204).end()
  } catch (error) { next(error) }
})

router.get('/me/history', requireAuth, async (req, res, next) => {
  try {
    const data = await Booking.find({ $or: [{ borrowerId: req.auth.sub }, { ownerId: req.auth.sub }] }).sort({ createdAt: -1 }).lean()
    res.json({ data })
  } catch (error) { next(error) }
})

router.get('/public/:id', async (req, res, next) => {
  try {
    const user = await User.findOne({ id: req.params.id, isActive: true }).lean()
    if (!user) return res.status(404).json({ error: 'Public profile not found' })
    const data = { id: user.id, name: user.name, role: user.role, gender: user.gender, bio: user.bio, avatarUrl: user.avatarUrl, emailVerified: user.emailVerified, identityVerified: user.identityVerified, createdAt: user.createdAt }
    if (user.privacySettings?.showEmail) data.email = user.email
    if (user.privacySettings?.showPhone) data.phone = user.phone
    if (user.privacySettings?.showLocation) data.location = user.location
    res.json({ data })
  } catch (error) { next(error) }
})

router.patch('/me/settings', requireAuth, async (req, res, next) => {
  try {
    const input = settingsSchema.parse(req.body)
    const user = await User.findOne({ id: req.auth.sub })
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (input.privacySettings) Object.assign(user.privacySettings || (user.privacySettings = {}), input.privacySettings)
    if (input.notificationSettings) Object.assign(user.notificationSettings || (user.notificationSettings = {}), input.notificationSettings)
    await user.save()
    res.json({ data: publicUser(user) })
  } catch (error) { next(error) }
})

router.post('/me/phone/send-otp', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findOne({ id: req.auth.sub })
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (!process.env.SMS_PROVIDER || !process.env.SMS_API_KEY) return res.status(503).json({ error: 'Phone OTP delivery is not configured. Add SMS_PROVIDER and SMS_API_KEY.' })
    const code = String(crypto.randomInt(100000, 1000000))
    user.phoneOtpHash = crypto.createHash('sha256').update(code).digest('hex')
    user.phoneOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000)
    user.phoneOtpAttempts = 0
    await user.save()
    res.json({ data: { message: 'Phone verification code sent.' } })
  } catch (error) { next(error) }
})

router.post('/me/phone/verify-otp', requireAuth, async (req, res, next) => {
  try {
    const { code } = otpSchema.parse(req.body)
    const user = await User.findOne({ id: req.auth.sub }).select('+phoneOtpHash +phoneOtpExpiresAt +phoneOtpAttempts')
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.phoneOtpAttempts >= 5) return res.status(429).json({ error: 'Too many OTP attempts. Request a new code.' })
    user.phoneOtpAttempts += 1
    if (!user.phoneOtpExpiresAt || user.phoneOtpExpiresAt < new Date() || user.phoneOtpHash !== crypto.createHash('sha256').update(code).digest('hex')) {
      await user.save()
      return res.status(400).json({ error: 'Invalid or expired phone verification code' })
    }
    user.phoneVerified = true
    user.phoneOtpHash = undefined
    user.phoneOtpExpiresAt = undefined
    user.phoneOtpAttempts = 0
    await user.save()
    res.json({ data: { phoneVerified: true } })
  } catch (error) { next(error) }
})

router.post('/me/identity-verification', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findOneAndUpdate({ id: req.auth.sub }, { identityVerificationStatus: 'pending' }, { new: true })
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.status(202).json({ data: { identityVerificationStatus: user.identityVerificationStatus, message: 'Identity verification request submitted for review.' } })
  } catch (error) { next(error) }
})

router.post('/me/deactivate', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findOneAndUpdate({ id: req.auth.sub }, { isActive: false, deactivatedAt: new Date(), $inc: { tokenVersion: 1 } }, { new: true })
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.status(204).end()
  } catch (error) { next(error) }
})

router.delete('/me', requireAuth, async (req, res, next) => {
  try {
    const input = deleteSchema.parse(req.body)
    const user = await User.findOne({ id: req.auth.sub }).select('+passwordHash')
    if (!user || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) return res.status(400).json({ error: 'Current password is incorrect' })
    await User.deleteOne({ id: req.auth.sub })
    res.status(204).end()
  } catch (error) { next(error) }
})

function publicUser(user) {
  if (typeof user.toObject === 'function') {
    const plain = user.toObject()
    delete plain.passwordHash
    delete plain._id
    delete plain.verificationTokenHash
    delete plain.verificationTokenExpiresAt
    delete plain.passwordResetTokenHash
    delete plain.passwordResetTokenExpiresAt
    delete plain.phoneOtpHash
    delete plain.phoneOtpExpiresAt
    delete plain.phoneOtpAttempts
    delete plain.refreshTokenHash
    delete plain.refreshTokenExpiresAt
    return plain
  }
  const { passwordHash, ...plain } = user
  delete plain.verificationTokenHash
  delete plain.verificationTokenExpiresAt
  delete plain.passwordResetTokenHash
  delete plain.passwordResetTokenExpiresAt
  delete plain.phoneOtpHash
  delete plain.phoneOtpExpiresAt
  delete plain.phoneOtpAttempts
  delete plain.refreshTokenHash
  delete plain.refreshTokenExpiresAt
  return plain
}

export default router
