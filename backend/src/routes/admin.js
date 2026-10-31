import { Router } from 'express'
import crypto from 'node:crypto'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { User } from '../models/User.js'
import { Item } from '../models/Item.js'
import { Booking } from '../models/Booking.js'
import { Category } from '../models/Category.js'
import { Report } from '../models/Report.js'
import { VerificationRequest } from '../models/VerificationRequest.js'
import { AuditLog } from '../models/AuditLog.js'
import { Review } from '../models/Review.js'
import { Dispute } from '../models/Dispute.js'
import { sendIdentityVerificationResultEmail } from '../services/email.js'
import { signedPrivateImageUrl } from '../services/cloudinary.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

router.get('/users', async (req, res, next) => {
  try {
    const page = z.coerce.number().int().positive().default(1).parse(req.query.page)
    const limit = Math.min(50, z.coerce.number().int().positive().default(20).parse(req.query.limit))
    const q = String(req.query.q || '').trim()
    const filter = q ? { $or: [{ name: new RegExp(escapeRegex(q), 'i') }, { email: new RegExp(escapeRegex(q), 'i') }] } : {}
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true'
    const [total, data] = await Promise.all([User.countDocuments(filter), User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean()])
    res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  } catch (error) { next(error) }
})

router.patch('/users/:id/status', async (req, res, next) => {
  try {
    const active = z.object({ active: z.boolean() }).parse(req.body).active
    const user = await User.findOneAndUpdate({ id: req.params.id }, { isActive: active, ...(active ? {} : { deactivatedAt: new Date() }), $inc: { tokenVersion: 1 } }, { new: true }).lean()
    if (!user) return res.status(404).json({ error: 'User not found' })
    await audit(req, 'user.status', 'user', user.id, { active })
    res.json({ data: user })
  } catch (error) { next(error) }
})

router.get('/verification-requests', async (req, res, next) => {
  try {
    const data = await VerificationRequest.find(req.query.status ? { status: String(req.query.status) } : {}).sort({ createdAt: -1 }).lean()
    res.json({ data: data.map(request => ({ ...request, documentUrl: signedPrivateImageUrl(request.documentPublicId), selfieUrl: request.selfiePublicId ? signedPrivateImageUrl(request.selfiePublicId) : '' })) })
  } catch (error) { next(error) }
})

router.patch('/verification-requests/:id', async (req, res, next) => {
  try {
    const input = z.object({ status: z.enum(['approved', 'rejected']), rejectionReason: z.string().trim().max(500).optional() }).parse(req.body)
    const request = await VerificationRequest.findOne({ id: req.params.id })
    if (!request) return res.status(404).json({ error: 'Verification request not found' })
    request.status = input.status
    request.reviewedBy = req.auth.sub
    request.reviewedAt = new Date()
    request.rejectionReason = input.rejectionReason || ''
    await request.save()
    const user = await User.findOne({ id: request.userId })
    if (user) {
      user.identityVerified = input.status === 'approved'
      user.identityVerificationStatus = input.status
      await user.save()
      try { await sendIdentityVerificationResultEmail(user, input.status, input.rejectionReason) } catch (error) { console.warn(`Identity result email failed for ${user.id}: ${error.message}`) }
    }
    await audit(req, 'verification.review', 'verificationRequest', request.id, { status: input.status })
    res.json({ data: { id: request.id, status: request.status } })
  } catch (error) { next(error) }
})

router.get('/reports', async (req, res, next) => {
  try {
    const filter = {}
    if (req.query.status) filter.status = String(req.query.status)
    if (req.query.type === 'item') filter.itemId = { $exists: true }
    if (req.query.type === 'user') filter.userId = { $exists: true }
    res.json({ data: await Report.find(filter).sort({ createdAt: -1 }).lean() })
  } catch (error) { next(error) }
})

router.patch('/reports/:id', async (req, res, next) => {
  try {
    const status = z.object({ status: z.enum(['reviewing', 'resolved', 'dismissed']) }).parse(req.body).status
    const report = await Report.findOneAndUpdate({ id: req.params.id }, { status }, { new: true }).lean()
    if (!report) return res.status(404).json({ error: 'Report not found' })
    await audit(req, 'report.resolve', 'report', report.id, { status })
    res.json({ data: report })
  } catch (error) { next(error) }
})

router.delete('/reviews/:id', async (req, res, next) => {
  try {
    const review = await Review.findOneAndDelete({ id: req.params.id })
    if (!review) return res.status(404).json({ error: 'Review not found' })
    await audit(req, 'review.remove', 'review', review.id, {})
    res.status(204).end()
  } catch (error) { next(error) }
})

router.get('/disputes', async (_req, res, next) => {
  try { res.json({ data: await Dispute.find().sort({ createdAt: -1 }).lean() }) } catch (error) { next(error) }
})

router.patch('/disputes/:id', async (req, res, next) => {
  try {
    const input = z.object({ status: z.enum(['investigating', 'resolved', 'dismissed']), decision: z.string().trim().max(2000).optional() }).parse(req.body)
    const dispute = await Dispute.findOneAndUpdate({ id: req.params.id }, { ...input, resolvedBy: req.auth.sub, resolvedAt: new Date() }, { new: true }).lean()
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' })
    if (['resolved', 'dismissed'].includes(input.status)) await Booking.updateOne({ id: dispute.bookingId, status: 'Disputed' }, { $set: { status: input.status === 'resolved' ? 'Returned' : 'Cancelled' }, $push: { statusHistory: { status: input.status === 'resolved' ? 'Returned' : 'Cancelled', by: req.auth.sub, at: new Date() } } })
    await audit(req, 'dispute.resolve', 'dispute', dispute.id, input)
    res.json({ data: dispute })
  } catch (error) { next(error) }
})

router.patch('/items/:id/status', async (req, res, next) => {
  try {
    const status = z.object({ status: z.enum(['active', 'inactive', 'flagged', 'suspended']) }).parse(req.body).status
    const item = await Item.findOneAndUpdate({ id: req.params.id, deletedAt: null }, { status, isActive: status === 'active' }, { new: true }).lean()
    if (!item) return res.status(404).json({ error: 'Item not found' })
    await audit(req, 'item.status', 'item', item.id, { status })
    res.json({ data: item })
  } catch (error) { next(error) }
})

router.get('/bookings', async (_req, res, next) => {
  try { res.json({ data: await Booking.find().sort({ createdAt: -1 }).limit(200).lean() }) } catch (error) { next(error) }
})

router.get('/categories', async (_req, res, next) => {
  try { res.json({ data: await Category.find().sort({ name: 1 }).lean() }) } catch (error) { next(error) }
})

router.post('/categories', async (req, res, next) => {
  try {
    const input = z.object({ name: z.string().trim().min(2), slug: z.string().trim().min(2), subcategories: z.array(z.string().trim()).default([]), isActive: z.boolean().default(true) }).parse(req.body)
    const category = await Category.create({ id: `category-${crypto.randomUUID()}`, ...input })
    await audit(req, 'category.create', 'category', category.id, {})
    res.status(201).json({ data: category })
  } catch (error) { next(error) }
})

router.patch('/categories/:id', async (req, res, next) => {
  try {
    const input = z.object({ name: z.string().trim().min(2).optional(), slug: z.string().trim().min(2).optional(), subcategories: z.array(z.string().trim()).optional(), isActive: z.boolean().optional() }).strict().parse(req.body)
    const category = await Category.findOneAndUpdate({ id: req.params.id }, input, { new: true }).lean()
    if (!category) return res.status(404).json({ error: 'Category not found' })
    await audit(req, 'category.update', 'category', category.id, input)
    res.json({ data: category })
  } catch (error) { next(error) }
})

router.delete('/categories/:id', async (req, res, next) => {
  try {
    const category = await Category.findOneAndUpdate({ id: req.params.id }, { isActive: false }, { new: true }).lean()
    if (!category) return res.status(404).json({ error: 'Category not found' })
    await audit(req, 'category.deactivate', 'category', category.id, {})
    res.status(204).end()
  } catch (error) { next(error) }
})

router.get('/stats', async (_req, res, next) => {
  try {
    const [users, items, bookings, monthlyRegistrations, monthlyBookings] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Item.countDocuments({ deletedAt: null }),
      Booking.aggregate([{ $group: { _id: '$status', total: { $sum: 1 } } }]),
      User.aggregate([{ $match: { createdAt: { $gte: new Date(Date.now() - 365 * 86400000) } }, $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, total: { $sum: 1 } }, $sort: { _id: 1 } }]),
      Booking.aggregate([{ $match: { createdAt: { $gte: new Date(Date.now() - 365 * 86400000) } }, $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, total: { $sum: 1 } }, $sort: { _id: 1 } }])
    ])
    res.json({ data: { users, items, bookingsByStatus: bookings, monthlyRegistrations, monthlyBookings } })
  } catch (error) { next(error) }
})

async function audit(req, action, targetType, targetId, meta) {
  await AuditLog.create({ actorId: req.auth.sub, action, targetType, targetId, meta })
}

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

export default router
