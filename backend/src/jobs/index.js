import { Booking } from '../models/Booking.js'
import { User } from '../models/User.js'
import { sendBookingOverdueEmail, sendBookingReminderEmail } from '../services/email.js'

export function startJobs() {
  const run = async () => {
    const now = new Date()
    await Booking.updateMany({ status: { $in: ['Confirmed', 'Active'] }, endDate: { $lt: now } }, { $set: { status: 'Overdue' } })
    const candidates = await Booking.find({ status: { $in: ['Confirmed', 'Active', 'Overdue'] }, endDate: { $lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) } }).lean()
    for (const booking of candidates) {
      const user = await User.findOne({ id: booking.borrowerId }).lean()
      if (!user?.notificationSettings?.bookingUpdates) continue
      const overdueDays = Math.floor((startOfUtcDay(now) - startOfUtcDay(booking.endDate)) / 86400000)
      const reminder = overdueDays > 0 && [1, 3, 7].includes(overdueDays) ? `overdue-${overdueDays}` : overdueDays <= 0 ? 'due-day' : null
      if (!reminder || booking.remindersSent?.includes(reminder)) continue
      try {
        if (reminder.startsWith('overdue-')) await sendBookingOverdueEmail(user, booking, overdueDays)
        else await sendBookingReminderEmail(user, booking)
        await Booking.updateOne({ id: booking.id, remindersSent: { $ne: reminder } }, { $addToSet: { remindersSent: reminder }, $set: { reminderSentAt: new Date() } })
      } catch (error) {
        console.warn(`Booking reminder failed for ${booking.id}: ${error.message}`)
      }
    }

    function startOfUtcDay(value) {
      const date = new Date(value)
      return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    }
  }
  const timer = setInterval(() => run().catch(error => console.error('Lifecycle job failed:', error)), 15 * 60 * 1000)
  run().catch(error => console.error('Initial lifecycle job failed:', error))
  return {
    stop() { clearInterval(timer) }
  }
}
