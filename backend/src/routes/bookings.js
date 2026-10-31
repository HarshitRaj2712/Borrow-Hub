import { Router } from 'express'
import { z } from 'zod'
import { getStore, persist } from '../config/store.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
const requestSchema = z.object({ startDate: z.coerce.date(), endDate: z.coerce.date(), message: z.string().trim().max(500).optional() }).refine(value => value.endDate > value.startDate, { message: 'End date must be after start date' })
const validTransitions = { Pending: ['Approved', 'Rejected', 'Cancelled'], Approved: ['Payment Pending', 'Cancelled'], 'Payment Pending': ['Confirmed', 'Cancelled'], Confirmed: ['Active', 'Cancelled'], Active: ['Return Pending'], 'Return Pending': ['Returned'], Returned: [] }

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const store = await getStore()
    res.json({ data: store.bookings.filter(booking => booking.borrowerId === req.auth.sub || booking.ownerId === req.auth.sub) })
  } catch (error) { next(error) }
})

router.post('/items/:itemId/requests', requireAuth, async (req, res, next) => {
  try {
    const input = requestSchema.parse(req.body)
    const store = await getStore()
    const item = store.items.find(candidate => candidate.id === req.params.itemId)
    if (!item) return res.status(404).json({ error: 'Item not found' })
    if (item.ownerId === req.auth.sub) return res.status(400).json({ error: 'You cannot request your own item' })
    if (!item.available) return res.status(409).json({ error: 'This item is unavailable' })
    const overlaps = store.bookings.some(booking => booking.itemId === item.id && ['Approved', 'Payment Pending', 'Confirmed', 'Active', 'Return Pending'].includes(booking.status) && input.startDate < new Date(booking.endDate) && input.endDate > new Date(booking.startDate))
    if (overlaps) return res.status(409).json({ error: 'Those dates overlap an existing booking' })
    const duplicate = store.bookings.some(booking => booking.itemId === item.id && booking.borrowerId === req.auth.sub && booking.status === 'Pending' && input.startDate < new Date(booking.endDate) && input.endDate > new Date(booking.startDate))
    if (duplicate) return res.status(409).json({ error: 'You already have a pending request for those dates' })
    const days = Math.ceil((input.endDate - input.startDate) / 86400000)
    const booking = { id: `booking-${crypto.randomUUID()}`, itemId: item.id, itemTitle: item.title, borrowerId: req.auth.sub, ownerId: item.ownerId, startDate: input.startDate.toISOString(), endDate: input.endDate.toISOString(), message: input.message || '', days, amount: days * item.pricePerDay, deposit: item.deposit, status: 'Pending', createdAt: new Date().toISOString() }
    store.bookings.push(booking)
    await persist()
    res.status(201).json({ data: booking })
  } catch (error) { next(error) }
})

router.patch('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const status = z.object({ status: z.enum(['Approved', 'Rejected', 'Payment Pending', 'Confirmed', 'Active', 'Return Pending', 'Returned', 'Cancelled']) }).parse(req.body).status
    const store = await getStore()
    const booking = store.bookings.find(candidate => candidate.id === req.params.id)
    if (!booking) return res.status(404).json({ error: 'Booking not found' })
    if (![booking.borrowerId, booking.ownerId].includes(req.auth.sub)) return res.status(403).json({ error: 'You do not have access to this booking' })
    if (!validTransitions[booking.status].includes(status)) return res.status(409).json({ error: `Cannot move booking from ${booking.status} to ${status}` })
    if (['Approved', 'Rejected'].includes(status) && req.auth.sub !== booking.ownerId) return res.status(403).json({ error: 'Only the owner can approve or reject requests' })
    booking.status = status
    await persist()
    res.json({ data: booking })
  } catch (error) { next(error) }
})

export default router
