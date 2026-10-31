import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dataDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data')
const dataFile = path.join(dataDirectory, 'borrow-hub.json')

const seed = {
  users: [],
  items: [
    { id: 'item-headphones', title: 'Sony WH-1000XM5', description: 'Noise-cancelling headphones in excellent condition.', category: 'Electronics', condition: 'Like New', pricePerDay: 120, deposit: 800, location: { city: 'Bengaluru', area: 'Indiranagar', lat: 12.9784, lng: 77.6408 }, ownerId: 'seed-aarav', ownerName: 'Aarav Mehta', rating: 4.9, available: true, createdAt: '2026-10-01T10:00:00.000Z' },
    { id: 'item-camera', title: 'Canon EOS 1500D', description: 'Beginner-friendly DSLR with kit lens and spare battery.', category: 'Photography', condition: 'Good', pricePerDay: 450, deposit: 3000, location: { city: 'Bengaluru', area: 'Koramangala', lat: 12.9352, lng: 77.6245 }, ownerId: 'seed-diya', ownerName: 'Diya Shah', rating: 4.8, available: true, createdAt: '2026-09-20T10:00:00.000Z' },
    { id: 'item-tent', title: 'Camping Tent for 4', description: 'Water-resistant four-person tent with carry bag.', category: 'Sports & Outdoors', condition: 'Good', pricePerDay: 280, deposit: 1200, location: { city: 'Bengaluru', area: 'Jayanagar', lat: 12.925, lng: 77.5838 }, ownerId: 'seed-rohan', ownerName: 'Rohan Kapoor', rating: 5, available: true, createdAt: '2026-09-15T10:00:00.000Z' },
    { id: 'item-drill', title: 'Cordless Drill Set', description: '18V cordless drill with bits and charger.', category: 'Tools & Equipment', condition: 'Good', pricePerDay: 180, deposit: 900, location: { city: 'Bengaluru', area: 'Whitefield', lat: 12.9698, lng: 77.75 }, ownerId: 'seed-nisha', ownerName: 'Nisha Iyer', rating: 4.7, available: true, createdAt: '2026-09-10T10:00:00.000Z' }
  ],
  bookings: []
}

let state

export async function getStore() {
  if (state) return state
  try {
    state = JSON.parse(await fs.readFile(dataFile, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    await fs.mkdir(dataDirectory, { recursive: true })
    state = structuredClone(seed)
    await persist()
  }
  return state
}

export async function persist() {
  await fs.mkdir(dataDirectory, { recursive: true })
  await fs.writeFile(dataFile, JSON.stringify(state, null, 2), 'utf8')
}

export const categories = ['Electronics', 'Books and Study Materials', 'Sports Equipment', 'Home Appliances', 'Tools and Equipment', 'Musical Instruments', 'Clothing and Accessories', 'Photography Equipment']
