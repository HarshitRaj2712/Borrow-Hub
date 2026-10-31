import { Router } from 'express'
import { z } from 'zod'
import { Availability } from '../models/Availability.js'
import { Booking } from '../models/Booking.js'
import { Item } from '../models/Item.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
const dateRangeSchema = z.object({ startDate: z.coerce.date(), endDate: z.coerce.date() }).refine(value => value.endDate > value.startDate, { message: 'End date must be after start date', path: ['endDate'] })
const activeStatuses = ['Approved', 'Payment Pending', 'Confirmed', 'Active', 'Return Pending']

router.get('/items/:itemId', async (req, res, next) => {
  try {
    const item = await Item.findOne({ id: req.params.itemId }).lean()
    if (!item) return res.status(404).json({ error: 'Item not found' })
    const [booked, blocked] = await Promise.all([
      Booking.find({ itemId: item.id, status: { $in: activeStatuses } }).select('startDate endDate status -_id').lean(),
      Availability.find({ itemId: item.id }).select('startDate endDate -_id').lean()
    ])
    res.json({ data: { itemId: item.id, available: item.available, booked, blocked } })
  } catch (error) { next(error) }
})

router.post('/items/:itemId/blocks', requireAuth, async (req, res, next) => {
  try {
    const input = dateRangeSchema.parse(req.body)
    const item = await Item.findOne({ id: req.params.itemId }).lean()
    if (!item) return res.status(404).json({ error: 'Item not found' })
    if (item.ownerId !== req.auth.sub) return res.status(403).json({ error: 'Only the owner can block dates' })
    if (input.startDate < startOfToday()) return res.status(400).json({ error: 'Blocked dates cannot start in the past' })
    if (await Booking.exists({ itemId: item.id, status: { $in: activeStatuses }, ...overlapQuery(input.startDate, input.endDate) })) return res.status(409).json({ error: 'Dates overlap an existing booking' })
    const block = await Availability.create({ id: `availability-${crypto.randomUUID()}`, itemId: item.id, startDate: input.startDate, endDate: input.endDate })
    res.status(201).json({ data: block })
  } catch (error) { next(error) }
})

router.delete('/blocks/:id', requireAuth, async (req, res, next) => {
  try {
    const block = await Availability.findOne({ id: req.params.id })
    if (!block) return res.status(404).json({ error: 'Availability block not found' })
    const item = await Item.findOne({ id: block.itemId }).lean()
    if (!item || item.ownerId !== req.auth.sub) return res.status(403).json({ error: 'Only the owner can remove this block' })
    await block.deleteOne()
    res.status(204).end()
  } catch (error) { next(error) }
})

function overlapQuery(startDate, endDate) { return { startDate: { $lt: endDate }, endDate: { $gt: startDate } } }
function startOfToday() { const date = new Date(); date.setHours(0, 0, 0, 0); return date }

export default router
