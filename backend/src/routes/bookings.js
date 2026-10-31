import { Router } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { Booking } from '../models/Booking.js'
import { Item } from '../models/Item.js'
import { Availability } from '../models/Availability.js'
import { requireAuth } from '../middleware/auth.js'
import { ACTIVE_BOOKING_STATUSES, BOOKING_STATUSES } from '../constants/booking.js'
import { httpError } from '../utils/httpError.js'

const router = Router()
const requestSchema = z.object({ startDate: z.coerce.date(), endDate: z.coerce.date(), message: z.string().trim().max(500).optional() }).refine(value => value.endDate > value.startDate, { message: 'End date must be after start date', path: ['endDate'] })
const extensionSchema = z.object({ endDate: z.coerce.date() })
const activeStatuses = ACTIVE_BOOKING_STATUSES

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
    if (input.startDate < startOfToday()) return res.status(400).json({ error: 'Start date cannot be in the past' })
    const days = Math.ceil((input.endDate - input.startDate) / 86400000)
    if (days > 30) return res.status(400).json({ error: 'Borrowing cannot exceed 30 days' })
    const session = await mongoose.startSession()
    let booking
    try {
      await session.withTransaction(async () => {
        const item = await Item.findOne({ id: req.params.itemId }).session(session).lean()
        if (!item) throw httpError(404, 'Item not found')
        if (item.ownerId === req.auth.sub) throw httpError(400, 'You cannot request your own item')
        if (!item.available) throw httpError(409, 'This item is unavailable')
        if (days < item.minBorrowDays || days > item.maxBorrowDays) throw httpError(400, `Borrowing duration must be between ${item.minBorrowDays} and ${item.maxBorrowDays} days`)
        if (await Availability.exists({ itemId: item.id, ...overlapQuery(input.startDate, input.endDate) }).session(session)) throw httpError(409, 'Those dates are blocked by the owner')
        if (await Booking.exists({ itemId: item.id, status: { $in: activeStatuses }, ...overlapQuery(input.startDate, input.endDate) }).session(session)) throw httpError(409, 'Those dates overlap an existing booking')
        if (await Booking.exists({ itemId: item.id, borrowerId: req.auth.sub, status: 'Pending', ...overlapQuery(input.startDate, input.endDate) }).session(session)) throw httpError(409, 'You already have a pending request for those dates')
        ;[booking] = await Booking.create([{ id: `booking-${crypto.randomUUID()}`, itemId: item.id, itemTitle: item.title, borrowerId: req.auth.sub, ownerId: item.ownerId, startDate: input.startDate, endDate: input.endDate, message: input.message || '', days, amount: days * item.pricePerDay, deposit: item.deposit }], { session })
      })

      router.post('/:id/extend', requireAuth, async (req, res, next) => {
        try {
          const endDate = extensionSchema.parse(req.body).endDate
          const booking = await Booking.findOne({ id: req.params.id })
          if (!booking) return res.status(404).json({ error: 'Booking not found' })
          if (booking.borrowerId !== req.auth.sub) return res.status(403).json({ error: 'Only the borrower can request an extension' })
          if (!['Confirmed', 'Active'].includes(booking.status) || endDate <= booking.endDate) return res.status(409).json({ error: 'This booking cannot be extended to that date' })
          const item = await Item.findOne({ id: booking.itemId }).lean()
          const days = Math.ceil((endDate - booking.startDate) / 86400000)
          if (!item || days > item.maxBorrowDays) return res.status(400).json({ error: `The extension exceeds the ${item?.maxBorrowDays || 30}-day limit` })
          booking.extensionRequested = true
          booking.extensionRequestedEndDate = endDate
          booking.extensionStatus = 'pending'
          await booking.save()
          res.status(202).json({ data: booking })
        } catch (error) { next(error) }
      })

      router.patch('/:id/extend/status', requireAuth, async (req, res, next) => {
        try {
          const status = z.object({ status: z.enum(['approved', 'rejected']) }).parse(req.body).status
          const session = await mongoose.startSession()
          let updated
          try {
            await session.withTransaction(async () => {
              const booking = await Booking.findOne({ id: req.params.id }).session(session)
              if (!booking) throw httpError(404, 'Booking not found')
              if (booking.ownerId !== req.auth.sub) throw httpError(403, 'Only the owner can decide an extension')
              if (!booking.extensionRequested || booking.extensionStatus !== 'pending') throw httpError(409, 'No pending extension request')
              if (status === 'approved') {
                if (await Booking.exists({ id: { $ne: booking.id }, itemId: booking.itemId, status: { $in: activeStatuses }, ...overlapQuery(booking.endDate, booking.extensionRequestedEndDate) }).session(session)) throw httpError(409, 'The requested extension overlaps another booking')
                booking.endDate = booking.extensionRequestedEndDate
                booking.days = Math.ceil((booking.endDate - booking.startDate) / 86400000)
                const item = await Item.findOne({ id: booking.itemId }).session(session).lean()
                if (item) booking.amount = booking.days * item.pricePerDay
              }
              booking.extensionStatus = status
              booking.extensionRequested = false
              await booking.save({ session })
              updated = booking
            })
          } finally { await session.endSession() }
          res.json({ data: updated })
        } catch (error) { next(error) }
      })
    } finally {
      await session.endSession()
    }
    res.status(201).json({ data: booking })
  } catch (error) { next(error) }
})

router.patch('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const status = z.object({ status: z.enum(BOOKING_STATUSES.filter(value => !['Pending', 'Overdue', 'Disputed'].includes(value))) }).parse(req.body).status
    const session = await mongoose.startSession()
    let updatedBooking
    try {
      await session.withTransaction(async () => {
        const booking = await Booking.findOne({ id: req.params.id }).session(session)
        if (!booking) throw httpError(404, 'Booking not found')
        if (![booking.borrowerId, booking.ownerId].includes(req.auth.sub)) throw httpError(403, 'You do not have access to this booking')
        if (!canTransition(booking, status, req.auth.sub)) throw httpError(409, `Cannot move booking from ${booking.status} to ${status}`)
        if (activeStatuses.includes(status) && await Booking.exists({ id: { $ne: booking.id }, itemId: booking.itemId, status: { $in: activeStatuses }, ...overlapQuery(booking.startDate, booking.endDate) }).session(session)) throw httpError(409, 'Those dates overlap an existing booking')
        booking.status = status
        await booking.save({ session })
        updatedBooking = booking
      })
    } finally {
      await session.endSession()
    }
    res.json({ data: updatedBooking })
  } catch (error) { next(error) }
})

function canTransition(booking, nextStatus, actorId) {
  if (booking.status === 'Pending') return actorId === booking.ownerId ? ['Approved', 'Rejected'].includes(nextStatus) : actorId === booking.borrowerId && nextStatus === 'Cancelled'
  if (booking.status === 'Approved') return actorId === booking.borrowerId && ['Payment Pending', 'Cancelled'].includes(nextStatus)
  if (booking.status === 'Payment Pending') return false
  if (booking.status === 'Confirmed') return false
  if (booking.status === 'Active') return actorId === booking.borrowerId && nextStatus === 'Return Pending'
  if (booking.status === 'Return Pending') return actorId === booking.ownerId && nextStatus === 'Returned'
  return false
}
function overlapQuery(startDate, endDate) { return { startDate: { $lt: endDate }, endDate: { $gt: startDate } } }
function startOfToday() { const date = new Date(); date.setHours(0, 0, 0, 0); return date }

export default router
