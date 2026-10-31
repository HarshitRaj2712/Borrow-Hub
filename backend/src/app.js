import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import mongoSanitize from 'express-mongo-sanitize'
import morgan from 'morgan'
import authRoutes from './routes/auth.js'
import itemRoutes from './routes/items.js'
import bookingRoutes from './routes/bookings.js'
import userRoutes from './routes/users.js'
import availabilityRoutes from './routes/availability.js'
import adminRoutes from './routes/admin.js'
import qrRoutes from './routes/qr.js'
import conversationRoutes from './routes/conversations.js'
import notificationRoutes from './routes/notifications.js'
import reviewRoutes from './routes/reviews.js'
import recommendationRoutes from './routes/recommendations.js'
import disputeRoutes from './routes/disputes.js'
import { Category } from './models/Category.js'
import { errorHandler, notFound } from './middleware/errors.js'
import { healthController } from './controllers/health.js'

export const app = express()
app.set('trust proxy', 1)
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many authentication requests. Please try again later.' } })
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many sign-in attempts. Please try again later.' } })
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many password reset requests. Please try again later.' } })
const reactivationLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many reactivation attempts. Please try again later.' } })
const verificationLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many verification email requests. Please try again later.' } })
app.use(helmet())
app.use(cors({ origin: allowedOrigin }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(express.json({ limit: '1mb' }))
app.use(mongoSanitize())
app.get('/api/health', healthController)
app.get('/api/categories', async (_req, res, next) => {
  try {
    res.json({ data: await Category.find({ isActive: true }).sort({ name: 1 }).select('id name slug subcategories -_id').lean() })
  } catch (error) { next(error) }
})
app.post('/api/auth/login', loginLimiter)
app.post('/api/auth/forgot-password', resetLimiter)
app.post('/api/auth/reactivate', reactivationLimiter)
app.post('/api/auth/resend-verification', verificationLimiter)
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/items', itemRoutes)
app.use('/api/bookings', bookingRoutes)
app.use('/api/users', userRoutes)
app.use('/api/availability', availabilityRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/qr', qrRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/reviews', reviewRoutes)
app.use('/api/recommendations', recommendationRoutes)
app.use('/api/disputes', disputeRoutes)
app.use(notFound)
app.use(errorHandler)
