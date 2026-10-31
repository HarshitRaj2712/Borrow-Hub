import { Router } from 'express'
import { Notification } from '../models/Notification.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

router.get('/', async (req, res, next) => {
  try {
    const data = await Notification.find({ userId: req.auth.sub }).sort({ createdAt: -1 }).limit(100).lean()
    res.json({ data, unread: data.filter(notification => !notification.readAt).length })
  } catch (error) { next(error) }
})

router.post('/:id/read', async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate({ id: req.params.id, userId: req.auth.sub }, { readAt: new Date() }, { new: true }).lean()
    if (!notification) return res.status(404).json({ error: 'Notification not found' })
    res.json({ data: notification })
  } catch (error) { next(error) }
})

router.post('/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.auth.sub, readAt: { $exists: false } }, { $set: { readAt: new Date() } })
    res.status(204).end()
  } catch (error) { next(error) }
})

export default router
