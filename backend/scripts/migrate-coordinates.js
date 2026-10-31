import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDatabase } from '../src/config/database.js'
import { Item } from '../src/models/Item.js'

await connectDatabase()
const items = await Item.find({
  'location.lat': { $type: 'number' },
  'location.lng': { $type: 'number' },
  'location.coordinates': { $exists: false }
}).select('id location').lean()

for (const item of items) {
  await Item.updateOne({ id: item.id, 'location.coordinates': { $exists: false } }, {
    $set: { 'location.coordinates': [item.location.lng, item.location.lat] }
  })
}
console.log(`Migrated coordinates for ${items.length} items.`)
await mongoose.disconnect()
