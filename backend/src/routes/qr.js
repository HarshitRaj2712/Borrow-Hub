import { Router } from 'express'
import crypto from 'node:crypto'
import QRCode from 'qrcode'
import { z } from 'zod'
import { Booking } from '../models/Booking.js'
import { Item } from '../models/Item.js'
import { QRVerification } from '../models/QRVerification.js'
import { requireAuth } from '../middleware/auth.js'
import { httpError } from '../utils/httpError.js'

const router = Router()
const tokenSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) })

router.post('/bookings/:bookingId/generate', requireAuth, async (req, res, next) => {
  try {
    const type = z.object({ type: z.enum(['handover', 'return']) }).parse(req.body).type
    const booking = await Booking.findOne({ id: req.params.bookingId })
    if (!booking) return res.status(404).json({ error: 'Booking not found' })
    if (![booking.borrowerId, booking.ownerId].includes(req.auth.sub)) return res.status(403).json({ error: 'You do not have access to this booking' })
    if (type === 'handover' && !['Approved', 'Confirmed'].includes(booking.status)) return res.status(409).json({ error: 'This booking is not ready for handover' })
    if (type === 'return' && !['Active', 'Overdue'].includes(booking.status)) return res.status(409).json({ error: 'This booking is not ready for return' })
    await QRVerification.deleteMany({ bookingId: booking.id, type, usedAt: { $exists: false } })
    const token = crypto.randomBytes(32).toString('hex')
    const verification = await QRVerification.create({ id: `qr-${crypto.randomUUID()}`, bookingId: booking.id, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), type, expiresAt: new Date(Date.now() + 15 * 60 * 1000) })
    res.status(201).json({ data: { id: verification.id, type, expiresAt: verification.expiresAt, qrDataUrl: await QRCode.toDataURL(token) } })
  } catch (error) { next(error) }
})

router.post('/bookings/:bookingId/scan', requireAuth, async (req, res, next) => {
  try {
    const token = tokenSchema.parse(req.body).token
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const session = await Booking.startSession()
    let updated
    try {
      await session.withTransaction(async () => {
        const verification = await QRVerification.findOne({ bookingId: req.params.bookingId, tokenHash, usedAt: { $exists: false }, expiresAt: { $gt: new Date() } }).session(session)
        if (!verification) throw httpError(400, 'Invalid, expired, or already used QR token')
        const booking = await Booking.findOne({ id: req.params.bookingId }).session(session)
        if (!booking) throw httpError(404, 'Booking not found')
        if (verification.type === 'handover') {
          if (booking.ownerId !== req.auth.sub || booking.status !== 'Confirmed') throw httpError(403, 'Only the owner can complete a confirmed handover')
          booking.status = 'Active'
          booking.handoverAt = new Date()
        } else {
          if (booking.borrowerId !== req.auth.sub || !['Active', 'Overdue'].includes(booking.status)) throw httpError(403, 'Only the borrower can complete this return')
          booking.status = 'Returned'
          booking.returnedAt = new Date()
          await Item.updateOne({ id: booking.itemId }, { $inc: { borrowCount: 1 } }, { session })
        }
        booking.statusHistory.push({ status: booking.status, by: req.auth.sub, at: new Date() })
        await booking.save({ session })
        verification.usedAt = new Date()
        await verification.save({ session })
        updated = booking
      })
    } finally { await session.endSession() }
    res.json({ data: updated })
  } catch (error) { next(error) }
})

export default router
