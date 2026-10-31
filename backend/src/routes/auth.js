import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { getStore, persist } from '../config/store.js'
import { issueToken, requireAuth } from '../middleware/auth.js'

const router = Router()
const registerSchema = z.object({ name: z.string().trim().min(2), email: z.string().email().transform(value => value.toLowerCase()), phone: z.string().trim().min(7), password: z.string().min(8) })
const loginSchema = z.object({ email: z.string().email().transform(value => value.toLowerCase()), password: z.string().min(1) })

router.post('/register', async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body)
    const store = await getStore()
    if (store.users.some(user => user.email === input.email)) return res.status(409).json({ error: 'An account with this email already exists' })
    const user = { id: `user-${crypto.randomUUID()}`, name: input.name, email: input.email, phone: input.phone, passwordHash: await bcrypt.hash(input.password, 12), role: 'member', verified: false, createdAt: new Date().toISOString() }
    store.users.push(user)
    await persist()
    res.status(201).json({ data: { user: publicUser(user), token: issueToken(user) } })
  } catch (error) { next(error) }
})

router.post('/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body)
    const store = await getStore()
    const user = store.users.find(candidate => candidate.email === input.email)
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password' })
    res.json({ data: { user: publicUser(user), token: issueToken(user) } })
  } catch (error) { next(error) }
})

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = (await getStore()).users.find(candidate => candidate.id === req.auth.sub)
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ data: publicUser(user) })
  } catch (error) { next(error) }
})

function publicUser({ passwordHash, ...user }) {
  return user
}

export default router
