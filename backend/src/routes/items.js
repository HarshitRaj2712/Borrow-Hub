import { Router } from 'express'
import { z } from 'zod'
import { Item } from '../models/Item.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
const itemSchema = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(10).max(2000),
  category: z.string().trim().min(2),
  condition: z.enum(['New', 'Like New', 'Good', 'Fair']),
  pricePerDay: z.coerce.number().int().min(0),
  deposit: z.coerce.number().int().min(0),
  city: z.string().trim().min(2),
  area: z.string().trim().min(2),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional()
}).refine(value => value.lat === undefined || value.lng !== undefined, { message: 'Longitude is required when latitude is provided', path: ['lng'] })
  .refine(value => value.lng === undefined || value.lat !== undefined, { message: 'Latitude is required when longitude is provided', path: ['lat'] })

const locationQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().positive().max(100).default(10),
  sort: z.enum(['recent', 'priceAsc', 'priceDesc', 'distance']).default('recent')
}).refine(value => value.lat === undefined || value.lng !== undefined, { message: 'Longitude is required when latitude is provided', path: ['lng'] })
  .refine(value => value.lng === undefined || value.lat !== undefined, { message: 'Latitude is required when longitude is provided', path: ['lat'] })

router.get('/', async (req, res, next) => {
  try {
    const location = locationQuerySchema.parse(req.query)
    const query = String(req.query.q || '').trim()
    const filters = { available: true }
    if (query) filters.$or = [{ title: new RegExp(escapeRegex(query), 'i') }, { description: new RegExp(escapeRegex(query), 'i') }, { category: new RegExp(escapeRegex(query), 'i') }]
    if (req.query.category) filters.category = String(req.query.category)
    if (req.query.minPrice !== undefined) filters.pricePerDay = { ...filters.pricePerDay, $gte: Number(req.query.minPrice) }
    if (req.query.maxPrice !== undefined) filters.pricePerDay = { ...filters.pricePerDay, $lte: Number(req.query.maxPrice) }
    let items = await Item.find(filters).lean()
    items = items.map(item => location.lat === undefined || item.location.lat === undefined ? item : { ...item, distanceKm: distanceInKm(location.lat, location.lng, item.location.lat, item.location.lng) })
      .filter(item => location.lat === undefined || item.distanceKm === undefined || item.distanceKm <= location.radius)
      .sort((a, b) => location.sort === 'distance' ? (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) : location.sort === 'priceAsc' ? a.pricePerDay - b.pricePerDay : location.sort === 'priceDesc' ? b.pricePerDay - a.pricePerDay : new Date(b.createdAt) - new Date(a.createdAt))
    const page = Math.max(Number(req.query.page || 1), 1)
    const limit = Math.min(Math.max(Number(req.query.limit || 12), 1), 50)
    res.json({ data: items.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: items.length, pages: Math.ceil(items.length / limit) } })
  } catch (error) { next(error) }
})

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    res.json({ data: await Item.find({ ownerId: req.auth.sub }).sort({ createdAt: -1 }).lean() })
  } catch (error) { next(error) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const item = await Item.findOne({ id: req.params.id }).lean()
    if (!item) return res.status(404).json({ error: 'Item not found' })
    res.json({ data: item })
  } catch (error) { next(error) }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const input = itemSchema.parse(req.body)
    const { city, area, lat, lng, ...details } = input
    const item = await Item.create({ id: `item-${crypto.randomUUID()}`, ...details, location: { city, area, ...(lat !== undefined ? { lat, lng } : {}) }, ownerId: req.auth.sub, ownerName: req.auth.name || req.auth.email, available: true })
    res.status(201).json({ data: item })
  } catch (error) { next(error) }
})

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const input = itemSchema.partial().parse(req.body)
    const item = await Item.findOne({ id: req.params.id })
    if (!item) return res.status(404).json({ error: 'Item not found' })
    if (item.ownerId !== req.auth.sub) return res.status(403).json({ error: 'Only the owner can update this item' })
    const { city, area, lat, lng, ...details } = input
    Object.assign(item, details)
    if (city || area || lat !== undefined || lng !== undefined) Object.assign(item.location, { ...(city ? { city } : {}), ...(area ? { area } : {}), ...(lat !== undefined ? { lat } : {}), ...(lng !== undefined ? { lng } : {}) })
    await item.save()
    res.json({ data: item })
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
