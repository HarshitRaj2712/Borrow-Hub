import { Router } from 'express'
import { z } from 'zod'
import { Item } from '../models/Item.js'
import { requireAuth } from '../middleware/auth.js'
import { itemFields, itemSchema, itemUpdateSchema } from '../validators/item.js'
import { publicItem } from '../utils/publicItem.js'
import { Report } from '../models/Report.js'
import multer from 'multer'
import { uploadItemImage } from '../services/cloudinary.js'

const router = Router()
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) })

const locationQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().positive().max(100).default(10),
  sort: z.enum(['recent', 'priceAsc', 'priceDesc', 'distance']).default('recent')
}).refine(value => value.lat === undefined || value.lng !== undefined, { message: 'Longitude is required when latitude is provided', path: ['lng'] })
  .refine(value => value.lng === undefined || value.lat !== undefined, { message: 'Latitude is required when longitude is provided', path: ['lat'] })
const priceQuerySchema = z.coerce.number().finite().nonnegative()
const paginationQuerySchema = z.coerce.number().int().positive()

router.get('/', async (req, res, next) => {
  try {
    const location = locationQuerySchema.parse(req.query)
    const query = String(req.query.q || '').trim()
    const filters = { available: true, $and: [{ $or: [{ isActive: true }, { isActive: { $exists: false } }] }] }
    if (query) filters.$and.push({ $or: [{ title: new RegExp(escapeRegex(query), 'i') }, { description: new RegExp(escapeRegex(query), 'i') }, { category: new RegExp(escapeRegex(query), 'i') }] })
    if (req.query.category) filters.category = String(req.query.category)
    if (req.query.subcategory) filters.subcategory = String(req.query.subcategory)
    if (req.query.condition) filters.condition = String(req.query.condition)
    if (req.query.city) filters['location.city'] = new RegExp(`^${escapeRegex(String(req.query.city))}$`, 'i')
    if (req.query.area) filters['location.area'] = new RegExp(`^${escapeRegex(String(req.query.area))}$`, 'i')
    if (req.query.minRating !== undefined) filters.rating = { $gte: priceQuerySchema.parse(req.query.minRating) }
    if (req.query.minPrice !== undefined) filters.pricePerDay = { ...filters.pricePerDay, $gte: priceQuerySchema.parse(req.query.minPrice) }
    if (req.query.maxPrice !== undefined) filters.pricePerDay = { ...filters.pricePerDay, $lte: priceQuerySchema.parse(req.query.maxPrice) }
    const page = req.query.page === undefined ? 1 : paginationQuerySchema.parse(req.query.page)
    const limit = req.query.limit === undefined ? 12 : Math.min(paginationQuerySchema.parse(req.query.limit), 50)
    const sort = location.sort === 'priceAsc' ? { pricePerDay: 1 } : location.sort === 'priceDesc' ? { pricePerDay: -1 } : { createdAt: -1 }
    let items
    let total
    if (location.lat !== undefined) {
      const pipeline = [
        { $geoNear: { near: { type: 'Point', coordinates: [location.lng, location.lat] }, key: 'location.coordinates', distanceField: 'distanceMeters', maxDistance: location.radius * 1000, spherical: true, query: filters } },
        { $sort: location.sort === 'distance' ? { distanceMeters: 1 } : sort },
        { $facet: { data: [{ $skip: (page - 1) * limit }, { $limit: limit }], count: [{ $count: 'value' }] } }
      ]
      const [result] = await Item.aggregate(pipeline)
      items = result.data.map(item => ({ ...item, distanceKm: item.distanceMeters / 1000 }))
      total = result.count[0]?.value || 0
    } else {
      total = await Item.countDocuments(filters)
      items = await Item.find(filters).sort(sort).skip((page - 1) * limit).limit(limit).lean()
    }
    res.json({ data: items.map(publicItem), pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  } catch (error) { next(error) }
})

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    res.json({ data: await Item.find({ ownerId: req.auth.sub }).sort({ createdAt: -1 }).lean() })
  } catch (error) { next(error) }
})

router.get('/lookups/locations', async (_req, res, next) => {
  try {
    const activeFilter = { available: true, $or: [{ isActive: true }, { isActive: { $exists: false } }] }
    const [cities, areas] = await Promise.all([Item.distinct('location.city', activeFilter), Item.distinct('location.area', activeFilter)])
    res.json({ data: { cities: cities.filter(Boolean).sort(), areas: areas.filter(Boolean).sort() } })
  } catch (error) { next(error) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const item = await Item.findOne({ id: req.params.id, available: true, $or: [{ isActive: true }, { isActive: { $exists: false } }] }).lean()
    if (!item) return res.status(404).json({ error: 'Item not found' })
    res.json({ data: publicItem(item) })
  } catch (error) { next(error) }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const input = itemSchema.parse(req.body)
    const { city, area, lat, lng, ...details } = input
    const item = await Item.create({ id: `item-${crypto.randomUUID()}`, ...details, location: { city, area, ...(lat !== undefined ? { lat, lng, coordinates: [lng, lat] } : {}) }, ownerId: req.auth.sub, ownerName: req.auth.name || req.auth.email, available: true, isActive: true })
    res.status(201).json({ data: publicItem(item) })
  } catch (error) { next(error) }
})

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const input = itemUpdateSchema.parse(req.body)
    const item = await Item.findOne({ id: req.params.id })
    if (!item) return res.status(404).json({ error: 'Item not found' })
    if (item.ownerId !== req.auth.sub) return res.status(403).json({ error: 'Only the owner can update this item' })
    const { city, area, lat, lng, ...details } = input
    Object.assign(item, details)
    if (city || area || lat !== undefined || lng !== undefined) Object.assign(item.location, { ...(city ? { city } : {}), ...(area ? { area } : {}), ...(lat !== undefined ? { lat } : {}), ...(lng !== undefined ? { lng } : {}), ...(lat !== undefined && lng !== undefined ? { coordinates: [lng, lat] } : {}) })
    await item.save()
    res.json({ data: publicItem(item) })
  } catch (error) { next(error) }
})

router.patch('/:id/availability', requireAuth, async (req, res, next) => {
  try {
    const active = z.object({ active: z.boolean() }).parse(req.body).active
    const item = await Item.findOne({ id: req.params.id })
    if (!item) return res.status(404).json({ error: 'Item not found' })
    if (item.ownerId !== req.auth.sub) return res.status(403).json({ error: 'Only the owner can change item availability' })
    item.isActive = active
    item.available = active
    await item.save()
    res.json({ data: publicItem(item) })
  } catch (error) { next(error) }
})

router.post('/:id/images', requireAuth, imageUpload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'A JPEG, PNG, or WebP image is required' })
    const item = await Item.findOne({ id: req.params.id })
    if (!item) return res.status(404).json({ error: 'Item not found' })
    if (item.ownerId !== req.auth.sub) return res.status(403).json({ error: 'Only the owner can add item images' })
    const upload = await uploadItemImage(req.file.buffer, item.id)
    item.images.push({ url: upload.secure_url, publicId: upload.public_id })
    await item.save()
    res.status(201).json({ data: publicItem(item) })
  } catch (error) { next(error) }
})

router.post('/:id/reports', requireAuth, async (req, res, next) => {
  try {
    const reason = z.object({ reason: z.string().trim().min(5).max(500) }).parse(req.body).reason
    const item = await Item.findOne({ id: req.params.id }).lean()
    if (!item) return res.status(404).json({ error: 'Item not found' })
    const report = await Report.create({ id: `report-${crypto.randomUUID()}`, reporterId: req.auth.sub, itemId: item.id, reason })
    res.status(201).json({ data: report })
  } catch (error) { next(error) }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const item = await Item.findOne({ id: req.params.id })
    if (!item) return res.status(404).json({ error: 'Item not found' })
    if (item.ownerId !== req.auth.sub) return res.status(403).json({ error: 'Only the owner can delete this item' })
    await item.deleteOne()
    res.status(204).end()
  } catch (error) { next(error) }
})

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
function distanceInKm(latitudeA, longitudeA, latitudeB, longitudeB) {
  const radians = value => value * Math.PI / 180
  const latitudeDelta = radians(latitudeB - latitudeA)
  const longitudeDelta = radians(longitudeB - longitudeA)
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default router
