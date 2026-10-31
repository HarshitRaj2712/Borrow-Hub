import 'dotenv/config'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import mongoose from 'mongoose'
import { connectDatabase } from '../src/config/database.js'
import { User } from '../src/models/User.js'

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD
if (!email || !password) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required to seed an admin.')
if (password.length < 8 || password.length > 72) throw new Error('ADMIN_PASSWORD must be between 8 and 72 characters.')

await connectDatabase()
const existing = await User.findOne({ email }).select('+passwordHash')
if (existing) {
  existing.role = 'admin'
  existing.isActive = true
  await existing.save()
  console.log(`Promoted ${email} to admin.`)
} else {
  await User.create({ id: `user-${crypto.randomUUID()}`, name: 'Borrow Hub Admin', email, phone: 'admin', passwordHash: await bcrypt.hash(password, 12), role: 'admin', emailVerified: true, location: {}, bio: '', isActive: true })
  console.log(`Created admin ${email}.`)
}
await mongoose.disconnect()
