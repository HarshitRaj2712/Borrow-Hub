import { Router } from 'express'
import { z } from 'zod'
import { getStore, persist } from '../config/store.js'
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
    const store = await getStore()
    const location = locationQuerySchema.parse(req.query)
    const query = String(req.query.q || '').toLowerCase()
    const category = String(req.query.category || '')
    const minPrice = Number(req.query.minPrice || 0)
    const maxPrice = Number(req.query.maxPrice || Number.MAX_SAFE_INTEGER)
    const page = Math.max(Number(req.query.page || 1), 1)
    const limit = Math.min(Math.max(Number(req.query.limit || 12), 1), 50)
    const filtered = store.items
      .filter(item => item.available && (!query || `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(query)) && (!category || item.category === category) && item.pricePerDay >= minPrice && item.pricePerDay <= maxPrice)
      .map(item => {
        if (location.lat === undefined || item.location.lat === undefined || item.location.lng === undefined) return item
        return { ...item, distanceKm: distanceInKm(location.lat, location.lng, item.location.lat, item.location.lng) }
      })
      .filter(item => location.lat === undefined || item.distanceKm === undefined || item.distanceKm <= location.radius)
      .sort((a, b) => {
        if (location.sort === 'distance') return (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER)
        if (location.sort === 'priceAsc') return a.pricePerDay - b.pricePerDay
        if (location.sort === 'priceDesc') return b.pricePerDay - a.pricePerDay
        return new Date(b.createdAt) - new Date(a.createdAt)
      })
    const start = (page - 1) * limit
    res.json({ data: filtered.slice(start, start + limit), pagination: { page, limit, total: filtered.length, pages: Math.ceil(filtered.length / limit) } })
  } catch (error) { next(error) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const item = (await getStore()).items.find(candidate => candidate.id === req.params.id)
    if (!item) return res.status(404).json({ error: 'Item not found' })
    res.json({ data: item })
  } catch (error) { next(error) }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const input = itemSchema.parse(req.body)
    const store = await getStore()
    const user = store.users.find(candidate => candidate.id === req.auth.sub)
    const { city, area, lat, lng, ...details } = input
    const item = { id: `item-${crypto.randomUUID()}`, ...details, location: { city, area, ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}) }, ownerId: user.id, ownerName: user.name, rating: 0, available: true, createdAt: new Date().toISOString() }
    store.items.unshift(item)
    await persist()
    res.status(201).json({ data: item })
  } catch (error) { next(error) }
})

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const store = await getStore()
    const item = store.items.find(candidate => candidate.id === req.params.id)
    if (!item) return res.status(404).json({ error: 'Item not found' })
    if (item.ownerId !== req.auth.sub) return res.status(403).json({ error: 'Only the owner can update this item' })
    const input = itemSchema.partial().parse(req.body)
    const { city, area, lat, lng, ...details } = input
    Object.assign(item, details)
    if (city || area || lat !== undefined || lng !== undefined) {
      item.location = {
        ...item.location,
        ...(city ? { city } : {}),
        ...(area ? { area } : {}),
        ...(lat !== undefined ? { lat } : {}),
        ...(lng !== undefined ? { lng } : {})
      }
    }
    await persist()
    res.json({ data: item })
  } catch (error) { next(error) }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const store = await getStore()
    const index = store.items.findIndex(candidate => candidate.id === req.params.id)
    if (index < 0) return res.status(404).json({ error: 'Item not found' })
    if (store.items[index].ownerId !== req.auth.sub) return res.status(403).json({ error: 'Only the owner can delete this item' })
    store.items.splice(index, 1)
    await persist()
    res.status(204).end()
  } catch (error) { next(error) }
})

export default router

function distanceInKm(latitudeA, longitudeA, latitudeB, longitudeB) {
  const radians = value => value * Math.PI / 180
  const latitudeDelta = radians(latitudeB - latitudeA)
  const longitudeDelta = radians(longitudeB - longitudeA)
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
