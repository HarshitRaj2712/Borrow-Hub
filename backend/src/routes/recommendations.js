import { Router } from 'express'
import crypto from 'node:crypto'
import { Item } from '../models/Item.js'
import { Wishlist } from '../models/Wishlist.js'
import { UserActivity } from '../models/UserActivity.js'
import { requireAuth } from '../middleware/auth.js'
import { publicItem } from '../utils/publicItem.js'

const router = Router()

router.post('/wishlist/:itemId', requireAuth, async (req, res, next) => {
  try {
    const item = await Item.findOne({ id: req.params.itemId, deletedAt: null, status: 'active' }).lean()
    if (!item) return res.status(404).json({ error: 'Item not found' })
    const entry = await Wishlist.findOneAndUpdate({ userId: req.auth.sub, itemId: item.id }, { $setOnInsert: { id: `wishlist-${crypto.randomUUID()}` } }, { upsert: true, new: true, setDefaultsOnInsert: true })
    res.status(201).json({ data: entry })
  } catch (error) { next(error) }
})

router.delete('/wishlist/:itemId', requireAuth, async (req, res, next) => {
  try { await Wishlist.deleteOne({ userId: req.auth.sub, itemId: req.params.itemId }); res.status(204).end() } catch (error) { next(error) }
})

router.post('/activity/:itemId', requireAuth, async (req, res, next) => {
  try {
    const item = await Item.findOneAndUpdate({ id: req.params.itemId, deletedAt: null }, { $inc: { viewCount: 1 } }, { new: true }).lean()
    if (!item) return res.status(404).json({ error: 'Item not found' })
    await UserActivity.create({ userId: req.auth.sub, itemId: item.id, type: 'view' })
    res.status(204).end()
  } catch (error) { next(error) }
})

router.get('/wishlist', requireAuth, async (req, res, next) => {
  try {
    const entries = await Wishlist.find({ userId: req.auth.sub }).select('itemId -_id').lean()
    res.json({ data: await Item.find({ id: { $in: entries.map(entry => entry.itemId) }, deletedAt: null }).lean() })
  } catch (error) { next(error) }
})

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const activities = await UserActivity.find({ userId: req.auth.sub, type: 'view' }).sort({ createdAt: -1 }).limit(20).lean()
    const viewed = await Item.find({ id: { $in: activities.map(activity => activity.itemId) } }).select('category').lean()
    const categories = [...new Set(viewed.map(item => item.category))]
    const data = await Item.find({ category: { $in: categories }, status: 'active', available: true, deletedAt: null }).sort({ rating: -1, borrowCount: -1 }).limit(20).lean()
    res.json({ data: data.map(publicItem) })
  } catch (error) { next(error) }
})

router.get('/similar/:itemId', async (req, res, next) => {
  try {
    const item = await Item.findOne({ id: req.params.itemId, deletedAt: null }).lean()
    if (!item) return res.status(404).json({ error: 'Item not found' })
    const data = await Item.find({ id: { $ne: item.id }, category: item.category, status: 'active', available: true, deletedAt: null }).sort({ rating: -1, borrowCount: -1 }).limit(12).lean()
    res.json({ data: data.map(publicItem) })
  } catch (error) { next(error) }
})

router.get('/trending', async (_req, res, next) => {
  try {
    const data = await Item.find({ status: 'active', available: true, deletedAt: null }).sort({ borrowCount: -1, viewCount: -1 }).limit(20).lean()
    res.json({ data: data.map(publicItem) })
  } catch (error) { next(error) }
})

export default router
