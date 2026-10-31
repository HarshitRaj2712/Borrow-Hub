import test from 'node:test'
import assert from 'node:assert/strict'
import { itemSchema, itemUpdateSchema } from '../src/validators/item.js'
import { publicItem } from '../src/utils/publicItem.js'

test('item update schema supports partial updates and coordinate pairing', () => {
  assert.deepEqual(itemUpdateSchema.parse({ pricePerDay: 250 }), { pricePerDay: 250 })
  assert.throws(() => itemUpdateSchema.parse({ lat: 12.9 }), /Longitude is required/)
})

test('public item coordinates are rounded', () => {
  const item = publicItem({ id: 'item-1', location: { city: 'Bengaluru', area: 'Indiranagar', lat: 12.9716, lng: 77.5946 } })
  assert.equal(item.location.lat, 12.97)
  assert.equal(item.location.lng, 77.59)
})

test('item schema accepts a complete valid listing', () => {
  assert.equal(itemSchema.parse({
    title: 'Camera',
    description: 'A camera available for borrowing.',
    category: 'Photography',
    condition: 'Good',
    pricePerDay: 100,
    deposit: 500,
    city: 'Bengaluru',
    area: 'Indiranagar'
  }).title, 'Camera')
})
