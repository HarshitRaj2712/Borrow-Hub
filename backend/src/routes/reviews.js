import { Router } from 'express'
import crypto from 'node:crypto'
import { z } from 'zod'
import { Booking } from '../models/Booking.js'
import { Review } from '../models/Review.js'
import { Item } from '../models/Item.js'
import { User } from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
const reviewSchema = z.object({ rating: z.number().int().min(1).max(5), body: z.string().trim().max(1000).default('') })

router.post('/bookings/:bookingId', requireAuth, async (req, res, next) => {
  try {
    const input = reviewSchema.parse(req.body)
    const booking = await Booking.findOne({ id: req.params.bookingId }).lean()
    if (!booking || booking.status !== 'Returned' || ![booking.borrowerId, booking.ownerId].includes(req.auth.sub)) return res.status(409).json({ error: 'Reviews are available only to returned-booking participants' })
    const revieweeId = req.auth.sub === booking.borrowerId ? booking.ownerId : booking.borrowerId
    const review = await Review.create({ id: `review-${crypto.randomUUID()}`, bookingId: booking.id, reviewerId: req.auth.sub, revieweeId, itemId: booking.itemId, ...input })
    const [itemReviews, userReviews] = await Promise.all([
      Review.aggregate([{ $match: { itemId: booking.itemId } }, { $group: { _id: null, average: { $avg: '$rating' } } }]),
      Review.aggregate([{ $match: { revieweeId } }, { $group: { _id: null, average: { $avg: '$rating' } } }])
    ])
    await Promise.all([
      Item.updateOne({ id: booking.itemId }, { rating: itemReviews[0]?.average || 0 }),
      User.updateOne({ id: revieweeId }, { trustScore: userReviews[0]?.average || 0 })
    ])
    res.status(201).json({ data: review })
  } catch (error) { next(error) }
})

router.get('/items/:itemId', async (req, res, next) => {
  try { res.json({ data: await Review.find({ itemId: req.params.itemId }).sort({ createdAt: -1 }).lean() }) } catch (error) { next(error) }
})

export default router
