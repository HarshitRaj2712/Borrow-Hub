import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import authRoutes from './routes/auth.js'
import itemRoutes from './routes/items.js'
import bookingRoutes from './routes/bookings.js'
import userRoutes from './routes/users.js'
import availabilityRoutes from './routes/availability.js'
import { Item } from './models/Item.js'
import { errorHandler, notFound } from './middleware/errors.js'
import { healthController } from './controllers/health.js'

export const app = express()
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many authentication requests. Please try again later.' } })
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many sign-in attempts. Please try again later.' } })
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many password reset requests. Please try again later.' } })
app.use(helmet())
app.use(cors({ origin: allowedOrigin }))
app.use(express.json({ limit: '1mb' }))
app.get('/api/health', healthController)
app.get('/api/categories', async (_req, res, next) => {
  try {
    res.json({ data: await Item.distinct('category') })
  } catch (error) { next(error) }
})
app.post('/api/auth/login', loginLimiter)
app.post('/api/auth/forgot-password', resetLimiter)
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/items', itemRoutes)
app.use('/api/bookings', bookingRoutes)
app.use('/api/users', userRoutes)
app.use('/api/availability', availabilityRoutes)
app.use(notFound)
app.use(errorHandler)
