import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { User } from '../models/User.js'
import { issueToken, requireAuth } from '../middleware/auth.js'
import { createVerificationToken, hashToken, sendVerificationEmail } from '../services/email.js'

const router = Router()
const registerSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().email().transform(value => value.toLowerCase()),
  phone: z.string().trim().min(7),
  password: z.string().min(8),
  role: z.enum(['borrower', 'lender']).default('borrower'),
  gender: z.enum(['male', 'female', 'non_binary', 'prefer_not_to_say'])
})
const loginSchema = z.object({ email: z.string().email().transform(value => value.toLowerCase()), password: z.string().min(1) })

router.post('/register', async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body)
    if (await User.exists({ email: input.email })) return res.status(409).json({ error: 'An account with this email already exists' })
    const verification = createVerificationToken()
    const user = await User.create({ id: `user-${crypto.randomUUID()}`, name: input.name, email: input.email, phone: input.phone, passwordHash: await bcrypt.hash(input.password, 12), role: input.role, gender: input.gender, verified: false, emailVerified: false, verificationTokenHash: verification.hash, verificationTokenExpiresAt: verification.expiresAt, location: {}, bio: '' })
    let verificationEmailSent = true
    let verificationMessage = 'Verification email sent.'
    try { await sendVerificationEmail(user, verification.token) } catch (error) { verificationEmailSent = false; verificationMessage = error.message; console.warn(verificationMessage) }
    res.status(201).json({ data: { user: publicUser(user), token: issueToken(user), verificationEmailSent, verificationMessage } })
  } catch (error) { next(error) }
})

router.post('/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body)
    const user = await User.findOne({ email: input.email }).select('+passwordHash').lean()
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password' })
    res.json({ data: { user: publicUser(user), token: issueToken(user) } })
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
    if (!user || !user.verificationTokenExpiresAt || user.verificationTokenExpiresAt < new Date()) return res.status(400).send('This verification link is invalid or expired.')
    user.verified = true
    user.emailVerified = true
    user.verificationTokenHash = undefined
    user.verificationTokenExpiresAt = undefined
    await user.save()
    res.send('Your Borrow Hub profile is verified. You can close this window and return to the app.')
  } catch (error) { next(error) }
})

router.post('/resend-verification', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findOne({ id: req.auth.sub }).select('+verificationTokenHash +verificationTokenExpiresAt')
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (user.emailVerified || user.verified) return res.status(409).json({ error: 'This profile is already verified' })
    const verification = createVerificationToken()
    user.verificationTokenHash = verification.hash
    user.verificationTokenExpiresAt = verification.expiresAt
    await user.save()
    await sendVerificationEmail(user, verification.token)
    res.json({ data: { verificationEmailSent: true, message: 'Verification email sent.' } })
  } catch (error) { next(error) }
})

function publicUser(user) {
  if (typeof user.toObject === 'function') {
    const plain = user.toObject()
    delete plain.passwordHash
    delete plain._id
    delete plain.verificationTokenHash
    delete plain.verificationTokenExpiresAt
    return plain
  }
  const { passwordHash, ...plain } = user
  delete plain.verificationTokenHash
  delete plain.verificationTokenExpiresAt
  return plain
}

export default router
