import test from 'node:test'
import assert from 'node:assert/strict'
import { itemSchema, itemUpdateSchema } from '../src/validators/item.js'
import { publicItem } from '../src/utils/publicItem.js'
import { Item } from '../src/models/Item.js'
import { publicUser } from '../src/utils/serializers.js'
import { validateImageUpload } from '../src/utils/upload.js'

test('item update schema supports partial updates and coordinate pairing', () => {
  assert.deepEqual(itemUpdateSchema.parse({ pricePerDay: 250 }), { pricePerDay: 250 })
  assert.throws(() => itemUpdateSchema.parse({ lat: 12.9 }), /Longitude is required/)
})

test('public item coordinates are rounded', () => {
  const item = publicItem({ id: 'item-1', location: { city: 'Bengaluru', area: 'Indiranagar', lat: 12.9716, lng: 77.5946 } })
  assert.equal(item.location.lat, 12.97)
  assert.equal(item.location.lng, 77.59)
})

test('public item serializes Mongoose documents without internal fields or exact coordinates', () => {
  const item = new Item({
    id: 'item-document',
    title: 'Camera',
    description: 'A camera available for borrowing.',
    category: 'Photography',
    condition: 'Good',
    pricePerDay: 100,
    deposit: 500,
    location: { city: 'Bengaluru', area: 'Indiranagar', lat: 12.9716, lng: 77.5946, coordinates: [77.5946, 12.9716] },
    ownerId: 'user-1',
    ownerName: 'Owner'
  })
  const result = publicItem(item)
  assert.equal(result.title, 'Camera')
  assert.equal(result._doc, undefined)
  assert.equal(result.location.coordinates, undefined)
  assert.notEqual(result.location.lat, 12.9716)
  assert.notEqual(result.location.lng, 77.5946)
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

test('public user serialization removes session internals', () => {
  const result = publicUser({ id: 'user-1', name: 'User', tokenVersion: 3, passwordHash: 'secret' })
  assert.equal(result.id, 'user-1')
  assert.equal(result.tokenVersion, undefined)
  assert.equal(result.passwordHash, undefined)
})

test('image upload validation checks magic bytes', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00])
  assert.equal(validateImageUpload({ buffer: jpeg, mimetype: 'image/jpeg' }), 'image/jpeg')
  assert.throws(() => validateImageUpload({ buffer: Buffer.from('not-an-image'), mimetype: 'image/jpeg' }), /Invalid image file/)
})
