import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.js'
import itemRoutes from './routes/items.js'
import bookingRoutes from './routes/bookings.js'
import { categories } from './config/store.js'
import { errorHandler, notFound } from './middleware/errors.js'

export const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'borrow-hub-api', timestamp: new Date().toISOString() }))
app.get('/api/categories', (_req, res) => res.json({ data: categories }))
app.use('/api/auth', authRoutes)
app.use('/api/items', itemRoutes)
app.use('/api/bookings', bookingRoutes)
app.use(notFound)
app.use(errorHandler)
