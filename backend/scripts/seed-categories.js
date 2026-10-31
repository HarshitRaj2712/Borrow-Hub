import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDatabase } from '../src/config/database.js'
import { Category } from '../src/models/Category.js'

const names = [
  'Electronics',
  'Books and Study Materials',
  'Sports Equipment',
  'Home Appliances',
  'Tools and Equipment',
  'Musical Instruments',
  'Clothing and Accessories',
  'Photography Equipment'
]

await connectDatabase()
for (const name of names) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  await Category.updateOne({ slug }, { $setOnInsert: { id: `category-${slug}`, name, slug, subcategories: [], isActive: true } }, { upsert: true })
}
console.log(`Ensured ${names.length} categories.`)
await mongoose.disconnect()
