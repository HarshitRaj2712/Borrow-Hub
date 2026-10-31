import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { User } from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
const optionalLocationField = z.union([z.string().trim().min(2).max(100), z.literal('')]).optional()
const profileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().min(7).max(20).optional(),
  role: z.enum(['borrower', 'lender']).optional(),
  gender: z.enum(['male', 'female', 'non_binary', 'prefer_not_to_say']).optional(),
  bio: z.string().trim().max(500).optional(),
  city: optionalLocationField,
  area: optionalLocationField
}).strict()
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

router.patch('/me/password', requireAuth, async (req, res, next) => {
  try {
    const input = passwordSchema.parse(req.body)
    const user = await User.findOne({ id: req.auth.sub }).select('+passwordHash')
    if (!user) return res.status(404).json({ error: 'User not found' })
    if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) return res.status(400).json({ error: 'Current password is incorrect' })
    user.passwordHash = await bcrypt.hash(input.newPassword, 12)
    await user.save()
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
    return plain
  }
  const { passwordHash, ...plain } = user
  delete plain.verificationTokenHash
  delete plain.verificationTokenExpiresAt
  return plain
}

export default router
