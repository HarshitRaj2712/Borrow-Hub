import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.js'
import itemRoutes from './routes/items.js'
import bookingRoutes from './routes/bookings.js'
import userRoutes from './routes/users.js'
import availabilityRoutes from './routes/availability.js'
import { Item } from './models/Item.js'
import { errorHandler, notFound } from './middleware/errors.js'

export const app = express()
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'
app.use(cors({ origin: allowedOrigin }))
app.use(express.json({ limit: '1mb' }))
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'borrow-hub-api', database: app.locals.database?.mode || 'starting', timestamp: new Date().toISOString() }))
app.get('/api/categories', async (_req, res, next) => {
  try {
    res.json({ data: await Item.distinct('category') })
  } catch (error) { next(error) }
})
app.use('/api/auth', authRoutes)
app.use('/api/items', itemRoutes)
app.use('/api/bookings', bookingRoutes)
app.use('/api/users', userRoutes)
app.use('/api/availability', availabilityRoutes)
app.use(notFound)
app.use(errorHandler)
