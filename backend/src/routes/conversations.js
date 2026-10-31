import { Router } from 'express'
import crypto from 'node:crypto'
import { z } from 'zod'
import { Booking } from '../models/Booking.js'
import { Conversation } from '../models/Conversation.js'
import { Message } from '../models/Message.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
const messageSchema = z.object({ body: z.string().trim().min(1).max(2000) })

router.use(requireAuth)

router.get('/', async (req, res, next) => {
  try {
    const data = await Conversation.find({ $or: [{ borrowerId: req.auth.sub }, { ownerId: req.auth.sub }] }).sort({ lastMessageAt: -1 }).lean()
    res.json({ data })
  } catch (error) { next(error) }
})

router.post('/', async (req, res, next) => {
  try {
    const bookingId = z.object({ bookingId: z.string().min(1) }).parse(req.body).bookingId
    const booking = await Booking.findOne({ id: bookingId }).lean()
    if (!booking || ![booking.borrowerId, booking.ownerId].includes(req.auth.sub)) return res.status(403).json({ error: 'You do not have access to this booking' })
    const conversation = await Conversation.findOneAndUpdate({ bookingId }, { $setOnInsert: { id: `conversation-${crypto.randomUUID()}`, bookingId, borrowerId: booking.borrowerId, ownerId: booking.ownerId } }, { upsert: true, new: true, setDefaultsOnInsert: true })
    res.status(201).json({ data: conversation })
  } catch (error) { next(error) }
})

router.get('/:id/messages', async (req, res, next) => {
  try {
    const page = z.coerce.number().int().positive().default(1).parse(req.query.page)
    const limit = Math.min(50, z.coerce.number().int().positive().default(30).parse(req.query.limit))
    const conversation = await Conversation.findOne({ id: req.params.id, $or: [{ borrowerId: req.auth.sub }, { ownerId: req.auth.sub }] }).lean()
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' })
    const [total, data] = await Promise.all([Message.countDocuments({ conversationId: conversation.id }), Message.find({ conversationId: conversation.id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean()])
    res.json({ data: data.reverse(), pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  } catch (error) { next(error) }
})

router.post('/:id/messages', async (req, res, next) => {
  try {
    const body = messageSchema.parse(req.body).body
    const conversation = await Conversation.findOne({ id: req.params.id, $or: [{ borrowerId: req.auth.sub }, { ownerId: req.auth.sub }] })
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' })
    const message = await Message.create({ id: `message-${crypto.randomUUID()}`, conversationId: conversation.id, senderId: req.auth.sub, body })
    const currentUnread = conversation.unreadBy.get(req.auth.sub === conversation.borrowerId ? conversation.ownerId : conversation.borrowerId) || 0
    conversation.unreadBy.set(req.auth.sub === conversation.borrowerId ? conversation.ownerId : conversation.borrowerId, currentUnread + 1)
    conversation.lastMessageAt = new Date()
    await conversation.save()
    res.status(201).json({ data: message })
  } catch (error) { next(error) }
})

router.post('/:id/read', async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({ id: req.params.id, $or: [{ borrowerId: req.auth.sub }, { ownerId: req.auth.sub }] })
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' })
    await Message.updateMany({ conversationId: conversation.id, senderId: { $ne: req.auth.sub }, readAt: { $exists: false } }, { $set: { readAt: new Date() } })
    conversation.unreadBy.set(req.auth.sub, 0)
    await conversation.save()
    res.status(204).end()
  } catch (error) { next(error) }
})

export default router
