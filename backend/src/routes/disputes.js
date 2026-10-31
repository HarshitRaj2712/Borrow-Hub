import { Router } from 'express'
import crypto from 'node:crypto'
import { z } from 'zod'
import { Booking } from '../models/Booking.js'
import { Dispute } from '../models/Dispute.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
const disputeSchema = z.object({ reason: z.string().trim().min(10).max(2000), evidence: z.array(z.string().url()).max(10).default([]) })

router.use(requireAuth)

router.get('/', async (req, res, next) => {
  try {
    const bookings = await Booking.find({ $or: [{ borrowerId: req.auth.sub }, { ownerId: req.auth.sub }] }).select('id').lean()
    res.json({ data: await Dispute.find({ bookingId: { $in: bookings.map(booking => booking.id) } }).sort({ createdAt: -1 }).lean() })
  } catch (error) { next(error) }
})

router.post('/bookings/:bookingId', async (req, res, next) => {
  try {
    const input = disputeSchema.parse(req.body)
    const booking = await Booking.findOne({ id: req.params.bookingId })
    if (!booking || ![booking.borrowerId, booking.ownerId].includes(req.auth.sub)) return res.status(403).json({ error: 'You do not have access to this booking' })
    if (await Dispute.exists({ bookingId: booking.id })) return res.status(409).json({ error: 'This booking already has a dispute' })
    const dispute = await Dispute.create({ id: `dispute-${crypto.randomUUID()}`, bookingId: booking.id, openedBy: req.auth.sub, ...input })
    booking.status = 'Disputed'
    booking.statusHistory.push({ status: 'Disputed', by: req.auth.sub, at: new Date() })
    await booking.save()
    res.status(201).json({ data: dispute })
  } catch (error) { next(error) }
})

export default router
