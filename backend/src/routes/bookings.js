import { Router } from 'express'
import { z } from 'zod'
import { Booking } from '../models/Booking.js'
import { Item } from '../models/Item.js'
import { Availability } from '../models/Availability.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
const requestSchema = z.object({ startDate: z.coerce.date(), endDate: z.coerce.date(), message: z.string().trim().max(500).optional() }).refine(value => value.endDate > value.startDate, { message: 'End date must be after start date', path: ['endDate'] })
const activeStatuses = ['Approved', 'Payment Pending', 'Confirmed', 'Active', 'Return Pending']

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const filter = { $or: [{ borrowerId: req.auth.sub }, { ownerId: req.auth.sub }] }
    if (req.query.status) filter.status = String(req.query.status)
    res.json({ data: await Booking.find(filter).sort({ createdAt: -1 }).lean() })
  } catch (error) { next(error) }
})

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const booking = await Booking.findOne({ id: req.params.id }).lean()
    if (!booking) return res.status(404).json({ error: 'Booking not found' })
    if (![booking.borrowerId, booking.ownerId].includes(req.auth.sub)) return res.status(403).json({ error: 'You do not have access to this booking' })
    res.json({ data: booking })
  } catch (error) { next(error) }
})

router.post('/items/:itemId/requests', requireAuth, async (req, res, next) => {
  try {
    const input = requestSchema.parse(req.body)
    const item = await Item.findOne({ id: req.params.itemId }).lean()
    if (!item) return res.status(404).json({ error: 'Item not found' })
    if (item.ownerId === req.auth.sub) return res.status(400).json({ error: 'You cannot request your own item' })
    if (!item.available) return res.status(409).json({ error: 'This item is unavailable' })
    if (input.startDate < startOfToday()) return res.status(400).json({ error: 'Start date cannot be in the past' })
    const days = Math.ceil((input.endDate - input.startDate) / 86400000)
    if (days > 30) return res.status(400).json({ error: 'Borrowing cannot exceed 30 days' })
    if (await Availability.exists({ itemId: item.id, ...overlapQuery(input.startDate, input.endDate) })) return res.status(409).json({ error: 'Those dates are blocked by the owner' })
    if (await Booking.exists({ itemId: item.id, status: { $in: activeStatuses }, ...overlapQuery(input.startDate, input.endDate) })) return res.status(409).json({ error: 'Those dates overlap an existing booking' })
    if (await Booking.exists({ itemId: item.id, borrowerId: req.auth.sub, status: 'Pending', ...overlapQuery(input.startDate, input.endDate) })) return res.status(409).json({ error: 'You already have a pending request for those dates' })
    const booking = await Booking.create({ id: `booking-${crypto.randomUUID()}`, itemId: item.id, itemTitle: item.title, borrowerId: req.auth.sub, ownerId: item.ownerId, startDate: input.startDate, endDate: input.endDate, message: input.message || '', days, amount: days * item.pricePerDay, deposit: item.deposit })
    res.status(201).json({ data: booking })
  } catch (error) { next(error) }
})

router.patch('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const status = z.object({ status: z.enum(['Approved', 'Rejected', 'Payment Pending', 'Confirmed', 'Active', 'Return Pending', 'Returned', 'Cancelled']) }).parse(req.body).status
    const booking = await Booking.findOne({ id: req.params.id })
    if (!booking) return res.status(404).json({ error: 'Booking not found' })
    if (![booking.borrowerId, booking.ownerId].includes(req.auth.sub)) return res.status(403).json({ error: 'You do not have access to this booking' })
    if (!canTransition(booking, status, req.auth.sub)) return res.status(409).json({ error: `Cannot move booking from ${booking.status} to ${status}` })
    if (activeStatuses.includes(status) && await Booking.exists({ id: { $ne: booking.id }, itemId: booking.itemId, status: { $in: activeStatuses }, ...overlapQuery(booking.startDate, booking.endDate) })) return res.status(409).json({ error: 'Those dates overlap an existing booking' })
    booking.status = status
    await booking.save()
    res.json({ data: booking })
  } catch (error) { next(error) }
})

function canTransition(booking, nextStatus, actorId) {
  if (booking.status === 'Pending') return actorId === booking.ownerId ? ['Approved', 'Rejected'].includes(nextStatus) : actorId === booking.borrowerId && nextStatus === 'Cancelled'
  if (booking.status === 'Approved') return actorId === booking.borrowerId && ['Payment Pending', 'Cancelled'].includes(nextStatus)
  if (booking.status === 'Payment Pending') return actorId === booking.borrowerId && nextStatus === 'Confirmed'
  if (booking.status === 'Confirmed') return nextStatus === 'Active' && new Date() >= new Date(booking.startDate)
  if (booking.status === 'Active') return actorId === booking.borrowerId && nextStatus === 'Return Pending'
  if (booking.status === 'Return Pending') return actorId === booking.ownerId && nextStatus === 'Returned'
  return false
}
function overlapQuery(startDate, endDate) { return { startDate: { $lt: endDate }, endDate: { $gt: startDate } } }
function startOfToday() { const date = new Date(); date.setHours(0, 0, 0, 0); return date }

export default router
