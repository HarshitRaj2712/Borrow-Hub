import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
import { User } from '../models/User.js'
import { Booking } from '../models/Booking.js'
import { requireAuth } from '../middleware/auth.js'
import multer from 'multer'
import { deleteCloudinaryImage, uploadAvatar, uploadPrivateVerificationDocument } from '../services/cloudinary.js'
import { ACTIVE_BOOKING_STATUSES } from '../constants/booking.js'
import { publicUser } from '../utils/serializers.js'
import { validateImageUpload } from '../utils/upload.js'
import { VerificationRequest } from '../models/VerificationRequest.js'
import { Report } from '../models/Report.js'

const router = Router()
const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })
const verificationUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })
const optionalLocationField = z.union([z.string().trim().min(2).max(100), z.literal('')]).optional()
const profileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().min(7).max(20).optional(),
  gender: z.enum(['male', 'female', 'non_binary', 'prefer_not_to_say']).optional(),
  bio: z.string().trim().max(500).optional(),
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
  newPassword: z.string().min(8).max(72)
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
    validateImageUpload(req.file)
    const result = await uploadAvatar(req.file.buffer, req.auth.sub)
    const user = await User.findOne({ id: req.auth.sub })
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.avatarPublicId && user.avatarPublicId !== result.public_id) await deleteCloudinaryImage(user.avatarPublicId)
    user.avatarUrl = result.secure_url
    user.avatarPublicId = result.public_id
    await user.save()
    res.json({ data: publicUser(user) })
  } catch (error) { next(error) }
})

router.delete('/me/avatar', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findOne({ id: req.auth.sub })
    if (!user) return res.status(404).json({ error: 'User not found' })
    await deleteCloudinaryImage(user.avatarPublicId)
    user.avatarUrl = ''
    user.avatarPublicId = ''
    await user.save()
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
    const data = { id: user.id, name: user.name, avatarUrl: user.avatarUrl, bio: user.bio, emailVerified: user.emailVerified, identityVerified: user.identityVerified, createdAt: user.createdAt }
    if (user.privacySettings?.showEmail) data.email = user.email
    if (user.privacySettings?.showPhone) data.phone = user.phone
    if (user.privacySettings?.showLocation) data.location = user.location
    res.json({ data })
  } catch (error) { next(error) }
})

router.post('/:id/reports', requireAuth, async (req, res, next) => {
  try {
    const reason = z.object({ reason: z.string().trim().min(5).max(500) }).parse(req.body).reason
    const user = await User.findOne({ id: req.params.id, isActive: true }).select('id').lean()
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.id === req.auth.sub) return res.status(400).json({ error: 'You cannot report yourself' })
    if (await Report.exists({ reporterId: req.auth.sub, userId: user.id })) return res.status(409).json({ error: 'You have already reported this user' })
    const report = await Report.create({ id: `report-${crypto.randomUUID()}`, reporterId: req.auth.sub, userId: user.id, reason })
    res.status(201).json({ data: report })
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

router.post('/me/identity-verification', requireAuth, verificationUpload.fields([{ name: 'idDocument', maxCount: 1 }, { name: 'selfie', maxCount: 1 }]), async (req, res, next) => {
  try {
    const document = req.files?.idDocument?.[0]
    const selfie = req.files?.selfie?.[0]
    validateImageUpload(document)
    if (selfie) validateImageUpload(selfie)
    if (await VerificationRequest.exists({ userId: req.auth.sub, status: 'pending' })) return res.status(409).json({ error: 'You already have a pending identity verification request' })
    const [documentUpload, selfieUpload] = await Promise.all([
      uploadPrivateVerificationDocument(document.buffer, req.auth.sub, 'document'),
      selfie ? uploadPrivateVerificationDocument(selfie.buffer, req.auth.sub, 'selfie') : null
    ])
    const request = await VerificationRequest.create({ id: `verification-${crypto.randomUUID()}`, userId: req.auth.sub, documentPublicId: documentUpload.public_id, selfiePublicId: selfieUpload?.public_id || '' })
    const user = await User.findOneAndUpdate({ id: req.auth.sub }, { identityVerificationStatus: 'pending' }, { new: true })
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.status(202).json({ data: { id: request.id, identityVerificationStatus: user.identityVerificationStatus, message: 'Identity verification request submitted for review.' } })
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
    if (await Booking.exists({ $or: [{ borrowerId: user.id }, { ownerId: user.id }], status: { $in: ['Pending', ...ACTIVE_BOOKING_STATUSES] } })) return res.status(409).json({ error: 'This account cannot be deleted while it has pending or active bookings' })
    user.name = 'Deleted user'
    user.email = `deleted-${user.id}@invalid.local`
    user.phone = 'deleted'
    user.bio = ''
    user.avatarUrl = ''
    user.isActive = false
    user.deactivatedAt = new Date()
    user.tokenVersion += 1
    user.refreshTokenHash = undefined
    user.refreshTokenExpiresAt = undefined
    await user.save()
    res.status(204).end()
  } catch (error) { next(error) }
})

export default router
