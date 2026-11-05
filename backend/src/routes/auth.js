import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
import { User } from '../models/User.js'
import { issueToken, requireAuth } from '../middleware/auth.js'
import { createPasswordResetToken, createVerificationToken, hashToken, sendPasswordResetEmail, sendVerificationEmail } from '../services/email.js'
import { publicUser } from '../utils/serializers.js'
import multer from 'multer'
import { uploadAvatar } from '../services/cloudinary.js'
import { validateImageUpload } from '../utils/upload.js'

const router = Router()
const profileImageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })
const emailSchema = z.string().trim().email().transform(value => value.toLowerCase())
const registerSchema = z.object({
  name: z.string().trim().min(2),
  email: emailSchema,
  phone: z.string().trim().min(7),
  password: z.string().min(8).max(72),
  role: z.enum(['user', 'member', 'borrower', 'lender']).transform(value => ['user', 'member'].includes(value) ? 'borrower' : value).default('borrower'),
  gender: z.enum(['male', 'female', 'non_binary', 'prefer_not_to_say']).default('prefer_not_to_say')
})
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1) })
const refreshSchema = z.object({ refreshToken: z.string().regex(/^[a-f0-9]{64}$/) })
const logoutSchema = z.object({ refreshToken: z.string().regex(/^[a-f0-9]{64}$/).optional() })
const forgotPasswordSchema = z.object({ email: emailSchema })
const resetPasswordSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: z.string().min(8).max(72) })
const reactivateSchema = z.object({ email: emailSchema, password: z.string().min(1) })

router.post('/register', profileImageUpload.single('profileImage'), async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body)
    if (await User.exists({ email: input.email })) return res.status(409).json({ error: 'An account with this email already exists' })
    const verification = createVerificationToken()
    const userId = `user-${crypto.randomUUID()}`
    let avatar = {}
    if (req.file) {
      validateImageUpload(req.file)
      const result = await uploadAvatar(req.file.buffer, userId)
      avatar = { avatarUrl: result.secure_url, avatarPublicId: result.public_id }
    }
    const user = await User.create({ id: userId, name: input.name, email: input.email, phone: input.phone, passwordHash: await bcrypt.hash(input.password, 12), role: input.role, gender: input.gender, ...avatar, emailVerified: false, phoneVerified: false, identityVerified: false, verificationTokenHash: verification.hash, verificationTokenExpiresAt: verification.expiresAt, location: {}, bio: '', isActive: true })
    let verificationEmailSent = true
    let verificationMessage = 'Verification email sent.'
    try { await sendVerificationEmail(user, verification.token) } catch (error) { verificationEmailSent = false; verificationMessage = error.message; console.warn(verificationMessage) }
    res.status(201).json({ data: { user: publicUser(user), ...(await issueSession(user, req.get('user-agent'))), verificationEmailSent, verificationMessage } })
  } catch (error) { next(error) }
})

router.post('/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body)
    const user = await User.findOne({ email: input.email }).select('+passwordHash +refreshTokens')
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password' })
    if (!user.isActive) return res.status(403).json({ error: 'Account is deactivated' })
    res.json({ data: { user: publicUser(user), ...(await issueSession(user, req.get('user-agent'))) } })
  } catch (error) { next(error) }
})

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body)
    const user = await User.findOne({ refreshTokens: { $elemMatch: { hash: hashToken(refreshToken), expiresAt: { $gt: new Date() } } } }).select('+refreshTokens')
    if (!user) return res.status(401).json({ error: 'Invalid or expired refresh token' })
    if (!user.isActive) return res.status(403).json({ error: 'Account is deactivated' })
    res.json({ data: await issueSession(user, req.get('user-agent'), hashToken(refreshToken)) })
  } catch (error) { next(error) }
})

router.post('/reactivate', async (req, res, next) => {
  try {
    const input = reactivateSchema.parse(req.body)
    const user = await User.findOne({ email: input.email }).select('+passwordHash +refreshTokens')
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password' })
    user.isActive = true
    await user.save()
    res.json({ data: { user: publicUser(user), ...(await issueSession(user, req.get('user-agent'))) } })
  } catch (error) { next(error) }
})

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const { refreshToken } = logoutSchema.parse(req.body || {})
    const user = await User.findOne({ id: req.auth.sub }).select('+refreshTokens')
    if (user) {
      if (refreshToken) user.refreshTokens = user.refreshTokens.filter(token => token.hash !== hashToken(refreshToken))
      else user.tokenVersion += 1
      await user.save()
    }
    res.status(204).end()
  } catch (error) { next(error) }
})

router.post('/logout-all', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findOne({ id: req.auth.sub }).select('+refreshTokens')
    if (user) {
      user.tokenVersion += 1
      user.refreshTokens = []
      await user.save()
    }
    res.status(204).end()
  } catch (error) { next(error) }
})

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body)
    const user = await User.findOne({ email }).select('+passwordResetTokenHash +passwordResetTokenExpiresAt')
    if (user) {
      const reset = createPasswordResetToken()
      user.passwordResetTokenHash = reset.hash
      user.passwordResetTokenExpiresAt = reset.expiresAt
      await User.updateOne(
        { id: user.id },
        { $set: { passwordResetTokenHash: reset.hash, passwordResetTokenExpiresAt: reset.expiresAt } }
      )
      try {
        await sendPasswordResetEmail(user, reset.token)
      } catch (error) {
        console.warn(`Password reset email delivery failed for ${user.id}: ${error.message}`)
      }
    }
    res.json({ data: { message: 'If an account exists for that email, a password reset link has been sent.' } })
  } catch (error) { next(error) }
})

router.post('/reset-password', async (req, res, next) => {
  try {
    const input = resetPasswordSchema.parse(req.body)
    const user = await User.findOne({ passwordResetTokenHash: hashToken(input.token), passwordResetTokenExpiresAt: { $gt: new Date() } }).select('+passwordHash +passwordResetTokenHash +passwordResetTokenExpiresAt +refreshTokens')
    if (!user) return res.status(400).json({ error: 'Invalid or expired password reset token' })
    const passwordHash = await bcrypt.hash(input.password, 12)
    await User.updateOne(
      { id: user.id },
      {
        $set: { passwordHash, refreshTokens: [] },
        $unset: { passwordResetTokenHash: 1, passwordResetTokenExpiresAt: 1 },
        $inc: { tokenVersion: 1 }
      }
    )
    res.json({ data: { message: 'Password reset successfully. Please sign in again.' } })
  } catch (error) { next(error) }
})

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findOne({ id: req.auth.sub }).lean()
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ data: publicUser(user) })
  } catch (error) { next(error) }
})

router.get('/verify-email', async (req, res, next) => {
  try {
    const token = z.string().regex(/^[a-f0-9]{64}$/).parse(req.query.token)
    const user = await User.findOne({ verificationTokenHash: hashToken(token) }).select('+verificationTokenHash +verificationTokenExpiresAt')
    if (!user || !user.verificationTokenExpiresAt || user.verificationTokenExpiresAt < new Date()) return res.status(400).json({ error: 'This verification link is invalid or expired.' })
    user.emailVerified = true
    user.verificationTokenHash = undefined
    user.verificationTokenExpiresAt = undefined
    await user.save()
    res.json({ data: { message: 'Your Borrow Hub email is verified. You can close this window and return to the app.' } })
  } catch (error) { next(error) }
})

router.post('/resend-verification', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findOne({ id: req.auth.sub }).select('+verificationTokenHash +verificationTokenExpiresAt')
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.emailVerified) return res.status(409).json({ error: 'This email is already verified' })
    const verification = createVerificationToken()
    user.verificationTokenHash = verification.hash
    user.verificationTokenExpiresAt = verification.expiresAt
    await user.save()
    await sendVerificationEmail(user, verification.token)
    res.json({ data: { verificationEmailSent: true, message: 'Verification email sent.' } })
  } catch (error) { next(error) }
})

async function issueSession(user, userAgent = '', replaceHash) {
  const refreshToken = crypto.randomBytes(32).toString('hex')
  const refreshEntry = { hash: hashToken(refreshToken), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), userAgent: '' }
  const refreshTokens = [...(user.refreshTokens || []).filter(entry => entry.expiresAt > new Date() && entry.hash !== replaceHash), { ...refreshEntry, userAgent: userAgent || '' }].slice(-5)
  const tokenVersion = Number.isInteger(user.tokenVersion) && user.tokenVersion >= 0 ? user.tokenVersion : 0
  user.tokenVersion = tokenVersion
  await User.updateOne({ id: user.id }, { $set: { refreshTokens, tokenVersion } })
  return { token: issueToken(user), refreshToken }
}

export default router
