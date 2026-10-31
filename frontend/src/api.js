const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
  })
  const payload = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new Error(payload?.error || 'Request failed')
  return payload
}

export function listItems(params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))
  return request(`/items?${query}`)
}

export function listMyItems(token) {
  return request('/items/mine', { headers: { Authorization: `Bearer ${token}` } })
}

export function createItem(input, token) {
  return request('/items', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(input) })
}

export function registerUser(input) {
  return request('/auth/register', { method: 'POST', body: JSON.stringify(input) })
}

export function loginUser(input) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify(input) })
}

export function getProfile(token) {
  return request('/users/me', { headers: { Authorization: `Bearer ${token}` } })
}

export function updateProfile(input, token) {
  return request('/users/me', { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(input) })
}

export function resendVerification(token) {
  return request('/auth/resend-verification', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
}

export function listBookings(token) {
  return request('/bookings', { headers: { Authorization: `Bearer ${token}` } })
}

export function createBorrowRequest(itemId, input, token) {
  return request(`/bookings/items/${itemId}/requests`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(input) })
}

export function updateBookingStatus(id, status, token) {
  return request(`/bookings/${id}/status`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }) })
}

export function getAvailability(itemId) {
  return request(`/availability/items/${itemId}`)
}
