import { Router } from 'express'
import crypto from 'node:crypto'
import mongoose from 'mongoose'
import { z } from 'zod'
import { Booking } from '../models/Booking.js'
import { Item } from '../models/Item.js'
import { Availability } from '../models/Availability.js'
import { User } from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'
import { ACTIVE_BOOKING_STATUSES, BOOKING_STATUSES } from '../constants/booking.js'
import { httpError } from '../utils/httpError.js'
import { createNotification } from '../utils/notifications.js'

const router = Router()
const requestSchema = z.object({ startDate: z.coerce.date(), endDate: z.coerce.date(), message: z.string().trim().max(500).optional() }).refine(value => value.endDate > value.startDate, { message: 'End date must be after start date', path: ['endDate'] })
const extensionSchema = z.object({ endDate: z.coerce.date() })
const statusRequestSchema = z.object({ status: z.enum(BOOKING_STATUSES.filter(value => !['Pending', 'Overdue', 'Disputed'].includes(value))), cancelReason: z.string().trim().max(500).optional() })
const activeStatuses = ACTIVE_BOOKING_STATUSES

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const page = z.coerce.number().int().positive().default(1).parse(req.query.page)
    const limit = Math.min(50, z.coerce.number().int().positive().default(12).parse(req.query.limit))
    const role = req.query.role ? z.enum(['borrower', 'owner']).parse(req.query.role) : undefined
    const view = req.query.view ? z.enum(['current', 'upcoming', 'completed', 'cancelled', 'overdue']).parse(req.query.view) : undefined
    const filter = role === 'borrower' ? { borrowerId: req.auth.sub } : role === 'owner' ? { ownerId: req.auth.sub } : { $or: [{ borrowerId: req.auth.sub }, { ownerId: req.auth.sub }] }
    const now = new Date()
    if (view === 'current') filter.status = { $in: ['Approved', 'Payment Pending', 'Confirmed', 'Active', 'Return Pending'] }
    if (view === 'upcoming') Object.assign(filter, { startDate: { $gte: now }, status: { $nin: ['Cancelled', 'Rejected', 'Returned', 'Overdue', 'Disputed'] } })
    if (view === 'completed') filter.status = 'Returned'
    if (view === 'cancelled') filter.status = 'Cancelled'
    if (view === 'overdue') filter.status = 'Overdue'
    if (req.query.status) filter.status = String(req.query.status)
    const [total, bookings] = await Promise.all([
      Booking.countDocuments(filter),
      Booking.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean()
    ])
    const userIds = [...new Set(bookings.flatMap(booking => [booking.borrowerId, booking.ownerId]))]
    const itemIds = [...new Set(bookings.map(booking => booking.itemId))]
    const [users, items] = await Promise.all([
      User.find({ id: { $in: userIds } }).select('id name avatarUrl').lean(),
      Item.find({ id: { $in: itemIds } }).select('id images').lean()
    ])
    const usersById = new Map(users.map(user => [user.id, user]))
    const itemsById = new Map(items.map(item => [item.id, item]))
    const data = bookings.map(booking => ({
      ...booking,
      otherParty: usersById.get(booking.borrowerId === req.auth.sub ? booking.ownerId : booking.borrowerId) || null,
      itemImage: itemsById.get(booking.itemId)?.images?.[0] || null
    }))
    res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
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
    const startDate = utcDateOnly(input.startDate)
    const endDate = utcDateOnly(input.endDate)
    if (endDate <= startDate) return res.status(400).json({ error: 'Booking dates must span at least one whole day' })
    const borrower = await User.findOne({ id: req.auth.sub, isActive: true }).select('role emailVerified identityVerified').lean()
    const borrowerRole = borrower?.role === 'user' ? 'borrower' : borrower?.role
    if (borrowerRole !== 'borrower') return res.status(403).json({ error: 'Only borrower accounts can request items' })
    if (!borrower.emailVerified) return res.status(403).json({ error: 'Verify your account before requesting a booking' })
    if (process.env.REQUIRE_IDENTITY_FOR_BOOKING === 'true' && !borrower.identityVerified) return res.status(403).json({ error: 'Identity verification is required before requesting a booking' })
    if (startDate < startOfToday()) return res.status(400).json({ error: 'Start date cannot be in the past' })
    const days = wholeDays(startDate, endDate)
    const session = await mongoose.startSession()
    let booking
    try {
      await session.withTransaction(async () => {
        const item = await Item.findOne({ id: req.params.itemId, deletedAt: null }).session(session).lean()
        if (!item) throw httpError(404, 'Item not found')
        if (item.ownerId === req.auth.sub) throw httpError(400, 'You cannot request your own item')
        if (!item.available) throw httpError(409, 'This item is unavailable')
        if (days < item.minBorrowDays || days > item.maxBorrowDays) throw httpError(400, `Borrowing duration must be between ${item.minBorrowDays} and ${item.maxBorrowDays} days`)
        if (await Availability.exists({ itemId: item.id, ...overlapQuery(startDate, endDate) }).session(session)) throw httpError(409, 'Those dates are blocked by the owner')
        if (await Booking.exists({ itemId: item.id, status: { $in: activeStatuses }, ...overlapQuery(startDate, endDate) }).session(session)) throw httpError(409, 'Those dates overlap an existing booking')
        if (await Booking.exists({ itemId: item.id, borrowerId: req.auth.sub, status: 'Pending', ...overlapQuery(startDate, endDate) }).session(session)) throw httpError(409, 'You already have a pending request for those dates')
        const versionUpdate = await Item.updateOne({ id: item.id }, { $inc: { bookingVersion: 1 } }, { session })
        if (versionUpdate.modifiedCount !== 1) throw httpError(409, 'The item changed while booking; please try again')
        ;[booking] = await Booking.create([{ id: `booking-${crypto.randomUUID()}`, itemId: item.id, itemTitle: item.title, borrowerId: req.auth.sub, ownerId: item.ownerId, startDate, endDate, message: input.message || '', days, amount: days * item.pricePerDay, deposit: item.deposit, statusHistory: [{ status: 'Pending', by: req.auth.sub, at: new Date() }] }], { session })
        const owner = await User.findOne({ id: item.ownerId }).select('id notificationSettings').lean()
        await createNotification(owner, 'booking.request', `A new booking request was submitted for ${item.title}.`, { bookingId: booking.id })
      })

    } finally {
      await session.endSession()
    }
    res.status(201).json({ data: booking })
  } catch (error) { next(error) }
})

router.post('/:id/extend', requireAuth, async (req, res, next) => {
  try {
    const endDate = utcDateOnly(extensionSchema.parse(req.body).endDate)
    const booking = await Booking.findOne({ id: req.params.id })
    if (!booking) return res.status(404).json({ error: 'Booking not found' })
    if (booking.borrowerId !== req.auth.sub) return res.status(403).json({ error: 'Only the borrower can request an extension' })
    if (!['Confirmed', 'Active'].includes(booking.status) || endDate <= booking.endDate) return res.status(409).json({ error: 'This booking cannot be extended to that date' })
    const item = await Item.findOne({ id: booking.itemId }).lean()
    const days = wholeDays(utcDateOnly(booking.startDate), endDate)
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
          const versionUpdate = await Item.updateOne({ id: booking.itemId }, { $inc: { bookingVersion: 1 } }, { session })
          if (versionUpdate.modifiedCount !== 1) throw httpError(409, 'The item changed while approving the extension; please try again')
          if (await Booking.exists({ id: { $ne: booking.id }, itemId: booking.itemId, status: { $in: activeStatuses }, ...overlapQuery(booking.endDate, booking.extensionRequestedEndDate) }).session(session)) throw httpError(409, 'The requested extension overlaps another booking')
          booking.endDate = booking.extensionRequestedEndDate
          booking.days = wholeDays(utcDateOnly(booking.startDate), utcDateOnly(booking.endDate))
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

router.patch('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const input = statusRequestSchema.parse(req.body)
    const status = input.status
    const session = await mongoose.startSession()
    let updatedBooking
    try {
      await session.withTransaction(async () => {
        const booking = await Booking.findOne({ id: req.params.id }).session(session)
        if (!booking) throw httpError(404, 'Booking not found')
        if (![booking.borrowerId, booking.ownerId].includes(req.auth.sub)) throw httpError(403, 'You do not have access to this booking')
        if (!canTransition(booking, status, req.auth.sub)) throw httpError(409, `Cannot move booking from ${booking.status} to ${status}`)
        if (activeStatuses.includes(status)) {
          const versionUpdate = await Item.updateOne({ id: booking.itemId }, { $inc: { bookingVersion: 1 } }, { session })
          if (versionUpdate.modifiedCount !== 1) throw httpError(409, 'The item changed while updating the booking; please try again')
        }
        if (activeStatuses.includes(status) && await Booking.exists({ id: { $ne: booking.id }, itemId: booking.itemId, status: { $in: activeStatuses }, ...overlapQuery(booking.startDate, booking.endDate) }).session(session)) throw httpError(409, 'Those dates overlap an existing booking')
        booking.status = status
        booking.statusHistory.push({ status, by: req.auth.sub, at: new Date() })
        if (status === 'Cancelled') {
          booking.cancelledBy = req.auth.sub
          booking.cancelReason = input.cancelReason || ''
        }
        if (status === 'Active') booking.handoverAt = new Date()
        if (status === 'Returned') booking.returnedAt = new Date()
        await booking.save({ session })
        if (status === 'Returned') await Item.updateOne({ id: booking.itemId }, { $inc: { borrowCount: 1 } }, { session })
        const recipientId = req.auth.sub === booking.borrowerId ? booking.ownerId : booking.borrowerId
        const recipient = await User.findOne({ id: recipientId }).select('id notificationSettings').lean()
        await createNotification(recipient, 'booking.status', `Booking ${booking.itemTitle} changed to ${status}.`, { bookingId: booking.id, status })
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
  if (booking.status === 'Approved') {
    if (nextStatus === 'Cancelled') return actorId === booking.ownerId
    if (actorId !== booking.borrowerId) return false
    if (nextStatus === 'Confirmed') return booking.amount + booking.deposit === 0
    return nextStatus === 'Payment Pending'
  }
  if (booking.status === 'Payment Pending') return false
  if (booking.status === 'Confirmed') return actorId === booking.borrowerId && nextStatus === 'Cancelled'
  if (booking.status === 'Active') return actorId === booking.borrowerId && nextStatus === 'Return Pending'
  if (booking.status === 'Return Pending') return actorId === booking.ownerId && nextStatus === 'Returned'
  if (booking.status === 'Overdue') {
    return actorId === booking.borrowerId
      ? nextStatus === 'Return Pending'
      : actorId === booking.ownerId && nextStatus === 'Returned'
  }
  return false
}
function overlapQuery(startDate, endDate) { return { startDate: { $lt: endDate }, endDate: { $gt: startDate } } }
function utcDateOnly(value) {
  const date = new Date(value)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}
function wholeDays(startDate, endDate) { return Math.round((endDate - startDate) / 86400000) }
function startOfToday() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export default router
