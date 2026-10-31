const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

export async function listItems(params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
  const response = await fetch(`${API_URL}/items?${query}`)
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || 'Unable to load items')
  return payload
}

export async function registerUser(input) {
  const response = await fetch(`${API_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || 'Unable to create account')
  return payload
}

export async function createBorrowRequest(itemId, input, token) {
  const response = await fetch(`${API_URL}/bookings/items/${itemId}/requests`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(input) })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || 'Unable to create borrow request')
  return payload
}
