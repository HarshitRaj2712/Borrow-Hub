import 'dotenv/config'
import mongoose from 'mongoose'
import { User } from '../src/models/User.js'
import { connectDatabase } from '../src/config/database.js'

await connectDatabase()
const result = await User.updateMany({ role: { $in: ['member', 'borrower', 'lender'] } }, { $set: { role: 'user' } })
console.log(`Normalized ${result.modifiedCount} legacy user roles.`)
await mongoose.disconnect()
