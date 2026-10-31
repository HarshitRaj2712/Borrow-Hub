import { Router } from 'express'
import crypto from 'node:crypto'
import { z } from 'zod'
import { Item } from '../models/Item.js'
import { Category } from '../models/Category.js'
import { User } from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'
import { itemSchema, itemUpdateSchema } from '../validators/item.js'
import { publicItem } from '../utils/publicItem.js'
import { Report } from '../models/Report.js'
import { Booking } from '../models/Booking.js'
import { ACTIVE_BOOKING_STATUSES } from '../constants/booking.js'
import { Availability } from '../models/Availability.js'
import { validateImageUpload } from '../utils/upload.js'
import { httpError } from '../utils/httpError.js'
import multer from 'multer'
import { deleteCloudinaryFolder, deleteCloudinaryImage, optimizedImageUrl, uploadItemImage } from '../services/cloudinary.js'

const router = Router()
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

const locationQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().positive().max(100).default(10),
  sort: z.enum(['recent', 'priceAsc', 'priceDesc', 'distance', 'rating', 'mostBorrowed', 'popular']).default('recent')
}).refine(value => value.lat === undefined || value.lng !== undefined, { message: 'Longitude is required when latitude is provided', path: ['lng'] })
  .refine(value => value.lng === undefined || value.lat !== undefined, { message: 'Latitude is required when longitude is provided', path: ['lat'] })
const priceQuerySchema = z.coerce.number().finite().nonnegative()
const paginationQuerySchema = z.coerce.number().int().positive()
function overlapQuery(startDate, endDate) { return { startDate: { $lt: endDate }, endDate: { $gt: startDate } } }

router.get('/', async (req, res, next) => {
  try {
    const location = locationQuerySchema.parse(req.query)
    const query = String(req.query.q || '').trim()
    const filters = { available: true, deletedAt: null, $and: [{ $or: [{ status: 'active' }, { status: { $exists: false }, isActive: true }] }] }
    if (query) filters.$text = { $search: query }
    if (req.query.category) filters.category = String(req.query.category)
    if (req.query.subcategory) filters.subcategory = String(req.query.subcategory)
    if (req.query.condition) filters.condition = String(req.query.condition)
    if (req.query.city) filters['location.city'] = new RegExp(`^${escapeRegex(String(req.query.city))}$`, 'i')
    if (req.query.area) filters['location.area'] = new RegExp(`^${escapeRegex(String(req.query.area))}$`, 'i')
    if (req.query.minRating !== undefined) filters.rating = { $gte: priceQuerySchema.parse(req.query.minRating) }
    if (req.query.free !== undefined) filters.pricePerDay = { ...filters.pricePerDay, ...(String(req.query.free) === 'true' ? { $eq: 0 } : { $gt: 0 }) }
    if (req.query.verifiedOwner === 'true') filters.ownerId = { $in: await User.distinct('id', { identityVerified: true, isActive: true }) }
    if (req.query.minPrice !== undefined) filters.pricePerDay = { ...filters.pricePerDay, $gte: priceQuerySchema.parse(req.query.minPrice) }
    if (req.query.maxPrice !== undefined) filters.pricePerDay = { ...filters.pricePerDay, $lte: priceQuerySchema.parse(req.query.maxPrice) }
    if (req.query.startDate !== undefined || req.query.endDate !== undefined) {
      const startDate = z.coerce.date().parse(req.query.startDate)
      const endDate = z.coerce.date().parse(req.query.endDate)
      if (endDate <= startDate) throw httpError(400, 'End date must be after start date')
      const [bookedIds, blockedIds] = await Promise.all([
        Booking.distinct('itemId', { status: { $in: ACTIVE_BOOKING_STATUSES }, ...overlapQuery(startDate, endDate) }),
        Availability.distinct('itemId', overlapQuery(startDate, endDate))
      ])
      filters.id = { $nin: [...new Set([...bookedIds, ...blockedIds])] }
    }
    const page = req.query.page === undefined ? 1 : paginationQuerySchema.parse(req.query.page)
    const limit = req.query.limit === undefined ? 12 : Math.min(paginationQuerySchema.parse(req.query.limit), 50)
    const sort = location.sort === 'priceAsc' ? { pricePerDay: 1 } : location.sort === 'priceDesc' ? { pricePerDay: -1 } : req.query.sort === 'rating' ? { rating: -1 } : ['mostBorrowed', 'popular'].includes(String(req.query.sort)) ? { borrowCount: -1, viewCount: -1 } : { createdAt: -1 }
    let items
    let total
    if (location.lat !== undefined) {
      const pipeline = [
        { $geoNear: { near: { type: 'Point', coordinates: [location.lng, location.lat] }, key: 'location.coordinates', distanceField: 'distanceMeters', maxDistance: location.radius * 1000, spherical: true, query: filters } },
        { $sort: location.sort === 'distance' ? { distanceMeters: 1 } : sort },
        { $facet: { data: [{ $skip: (page - 1) * limit }, { $limit: limit }], count: [{ $count: 'value' }] } }
      ]
      const [result] = await Item.aggregate(pipeline)
      items = result.data.map(item => {
        const distanceKm = Math.max(1, Math.round(item.distanceMeters / 1000))
        const publicResult = publicItem(item)
        delete publicResult.distanceMeters
        publicResult.distanceKm = distanceKm
        return publicResult
      })
      total = result.count[0]?.value || 0
    } else {
      total = await Item.countDocuments(filters)
      items = await Item.find(filters).sort(sort).skip((page - 1) * limit).limit(limit).lean()
    }
    res.json({ data: location.lat === undefined ? items.map(publicItem) : items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  } catch (error) { next(error) }
})

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    res.json({ data: await Item.find({ ownerId: req.auth.sub, deletedAt: null }).sort({ createdAt: -1 }).lean() })
  } catch (error) { next(error) }
})

router.get('/lookups/locations', async (_req, res, next) => {
  try {
    const activeFilter = { available: true, deletedAt: null, $or: [{ status: 'active' }, { status: { $exists: false }, isActive: true }] }
    const [cities, areas] = await Promise.all([Item.distinct('location.city', activeFilter), Item.distinct('location.area', activeFilter)])
    res.json({ data: { cities: cities.filter(Boolean).sort(), areas: areas.filter(Boolean).sort() } })
  } catch (error) { next(error) }
})

router.get('/suggestions', async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim()
    if (!query) return res.json({ data: [] })
    const data = await Item.find({ deletedAt: null, available: true, $or: [{ status: 'active' }, { status: { $exists: false }, isActive: true }], $text: { $search: query } })
      .select('title -_id')
      .sort({ score: { $meta: 'textScore' } })
      .limit(8)
      .lean()
    res.json({ data: data.map(item => item.title) })
  } catch (error) { next(error) }
})

router.get('/:id', async (req, res, next) => {
  try {
    await Item.updateOne({ id: req.params.id, deletedAt: null }, { $inc: { viewCount: 1 } })
    const item = await Item.findOne({ id: req.params.id, available: true, deletedAt: null, $or: [{ status: 'active' }, { status: { $exists: false }, isActive: true }] }).lean()
    if (!item) return res.status(404).json({ error: 'Item not found' })
    res.json({ data: publicItem(item) })
  } catch (error) { next(error) }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const input = itemSchema.parse(req.body)
    const { city, area, lat, lng, ...details } = input
    if (!await Category.exists({ name: details.category, isActive: true })) return res.status(400).json({ error: 'Invalid or inactive item category' })
    const owner = await User.findOne({ id: req.auth.sub, isActive: true }).select('name').lean()
    if (!owner) return res.status(401).json({ error: 'Active user account required' })
    const item = await Item.create({ id: `item-${crypto.randomUUID()}`, ...details, location: { city, area, ...(lat !== undefined ? { lat, lng, coordinates: [lng, lat] } : {}) }, ownerId: req.auth.sub, ownerName: owner.name, status: 'active', available: true, isActive: true })
    res.status(201).json({ data: publicItem(item) })
  } catch (error) { next(error) }
})

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const input = itemUpdateSchema.parse(req.body)
    const item = await Item.findOne({ id: req.params.id, deletedAt: null })
    if (!item) return res.status(404).json({ error: 'Item not found' })
    if (item.ownerId !== req.auth.sub) return res.status(403).json({ error: 'Only the owner can update this item' })
    const { city, area, lat, lng, ...details } = input
    if (details.category !== undefined && !await Category.exists({ name: details.category, isActive: true })) return res.status(400).json({ error: 'Invalid or inactive item category' })
    Object.assign(item, details)
    if (city || area || lat !== undefined || lng !== undefined) Object.assign(item.location, { ...(city ? { city } : {}), ...(area ? { area } : {}), ...(lat !== undefined ? { lat } : {}), ...(lng !== undefined ? { lng } : {}), ...(lat !== undefined && lng !== undefined ? { coordinates: [lng, lat] } : {}) })
    await item.save()
    res.json({ data: publicItem(item) })
  } catch (error) { next(error) }
})

router.patch('/:id/availability', requireAuth, async (req, res, next) => {
  try {
    const active = z.object({ active: z.boolean() }).parse(req.body).active
    const item = await Item.findOne({ id: req.params.id, deletedAt: null })
    if (!item) return res.status(404).json({ error: 'Item not found' })
    if (item.ownerId !== req.auth.sub) return res.status(403).json({ error: 'Only the owner can change item availability' })
    item.status = active ? 'active' : 'inactive'
    item.available = active
    await item.save()
    res.json({ data: publicItem(item) })
  } catch (error) { next(error) }
})

router.post('/:id/images', requireAuth, imageUpload.single('image'), async (req, res, next) => {
  try {
    validateImageUpload(req.file)
    const item = await Item.findOne({ id: req.params.id, deletedAt: null })
    if (!item) return res.status(404).json({ error: 'Item not found' })
    if (item.ownerId !== req.auth.sub) return res.status(403).json({ error: 'Only the owner can add item images' })
    if (item.images.length >= 6) return res.status(409).json({ error: 'An item can have at most 6 images' })
    const upload = await uploadItemImage(req.file.buffer, item.id)
    item.images.push({ url: optimizedImageUrl(upload.public_id), publicId: upload.public_id })
    await item.save()
    res.status(201).json({ data: publicItem(item) })
  } catch (error) { next(error) }
})

router.patch('/:id/images/order', requireAuth, async (req, res, next) => {
  try {
    const publicIds = z.array(z.string().min(1)).max(6).parse(req.body)
    const item = await Item.findOne({ id: req.params.id, deletedAt: null })
    if (!item) return res.status(404).json({ error: 'Item not found' })
    if (item.ownerId !== req.auth.sub) return res.status(403).json({ error: 'Only the owner can reorder item images' })
    const existing = item.images.map(image => image.publicId)
    if (publicIds.length !== existing.length || new Set(publicIds).size !== existing.length || publicIds.some(publicId => !existing.includes(publicId))) return res.status(400).json({ error: 'Image order must contain the existing image set exactly once' })
    item.images = publicIds.map(publicId => item.images.find(image => image.publicId === publicId))
    await item.save()
    res.json({ data: publicItem(item) })
  } catch (error) { next(error) }
})

router.delete('/:id/images/:publicId', requireAuth, async (req, res, next) => {
  try {
    const publicId = decodeURIComponent(req.params.publicId)
    const item = await Item.findOne({ id: req.params.id, deletedAt: null })
    if (!item) return res.status(404).json({ error: 'Item not found' })
    if (item.ownerId !== req.auth.sub) return res.status(403).json({ error: 'Only the owner can delete item images' })
    if (!item.images.some(image => image.publicId === publicId)) return res.status(404).json({ error: 'Item image not found' })
    await deleteCloudinaryImage(publicId)
    item.images = item.images.filter(image => image.publicId !== publicId)
    await item.save()
    res.json({ data: publicItem(item) })
  } catch (error) { next(error) }
})

router.post('/:id/reports', requireAuth, async (req, res, next) => {
  try {
    const reason = z.object({ reason: z.string().trim().min(5).max(500) }).parse(req.body).reason
    const item = await Item.findOne({ id: req.params.id, deletedAt: null }).lean()
    if (!item) return res.status(404).json({ error: 'Item not found' })
    if (await Report.exists({ reporterId: req.auth.sub, itemId: item.id })) return res.status(409).json({ error: 'You have already reported this item' })
    const report = await Report.create({ id: `report-${crypto.randomUUID()}`, reporterId: req.auth.sub, itemId: item.id, reason })
    if (await Report.countDocuments({ itemId: item.id, status: 'open' }) >= 3) await Item.updateOne({ id: item.id }, { $set: { status: 'flagged' } })
    res.status(201).json({ data: report })
  } catch (error) { next(error) }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const item = await Item.findOne({ id: req.params.id, deletedAt: null })
    if (!item) return res.status(404).json({ error: 'Item not found' })
    if (item.ownerId !== req.auth.sub) return res.status(403).json({ error: 'Only the owner can delete this item' })
    if (await Booking.exists({ itemId: item.id, status: { $in: ['Pending', ...ACTIVE_BOOKING_STATUSES] } })) return res.status(409).json({ error: 'This item cannot be deleted while it has pending or active bookings' })
    await deleteCloudinaryFolder(`borrow-hub/items/${item.id}`)
    item.deletedAt = new Date()
    item.status = 'inactive'
    item.available = false
    item.isActive = false
    await item.save()
    res.status(204).end()
  } catch (error) { next(error) }
})

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
export default router
