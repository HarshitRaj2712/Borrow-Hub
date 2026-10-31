import { Booking } from '../models/Booking.js'
import { User } from '../models/User.js'
import { sendBookingReminderEmail } from '../services/email.js'

export function startJobs() {
  const run = async () => {
    const now = new Date()
    await Booking.updateMany({ status: { $in: ['Confirmed', 'Active', 'Return Pending'] }, endDate: { $lt: now } }, { $set: { status: 'Overdue' } })
    const upcoming = await Booking.find({ status: { $in: ['Confirmed', 'Active'] }, endDate: { $gt: now, $lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) }, reminderSentAt: { $exists: false } }).lean()
    for (const booking of upcoming) {
      const user = await User.findOne({ id: booking.borrowerId }).lean()
      if (!user?.notificationSettings?.bookingUpdates) continue
      try {
        await sendBookingReminderEmail(user, booking)
        await Booking.updateOne({ id: booking.id, reminderSentAt: { $exists: false } }, { $set: { reminderSentAt: new Date() } })
      } catch (error) {
        console.warn(`Booking reminder failed for ${booking.id}: ${error.message}`)
      }
    }
  }
  const timer = setInterval(() => run().catch(error => console.error('Lifecycle job failed:', error)), 15 * 60 * 1000)
  run().catch(error => console.error('Initial lifecycle job failed:', error))
  return {
    stop() { clearInterval(timer) }
  }
}
