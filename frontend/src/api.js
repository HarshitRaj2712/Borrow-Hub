const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

async function request(path, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
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

export function refreshSession(refreshToken) {
  return request('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) })
}

export function logoutUser(token) {
  return request('/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
}

export function forgotPassword(email) {
  return request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
}

export function resetPassword(token, password) {
  return request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) })
}

export function verifyEmail(token) {
  return request(`/auth/verify-email?token=${encodeURIComponent(token)}`)
}

export function getPublicProfile(id) {
  return request(`/users/public/${id}`)
}

export function getProfileHistory(token) {
  return request('/users/me/history', { headers: { Authorization: `Bearer ${token}` } })
}

export function updateProfileSettings(input, token) {
  return request('/users/me/settings', { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(input) })
}

export function requestIdentityVerification(token) {
  return request('/users/me/identity-verification', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
}

export function sendPhoneOtp(token) {
  return request('/users/me/phone/send-otp', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
}

export function verifyPhoneOtp(code, token) {
  return request('/users/me/phone/verify-otp', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ code }) })
}

export function deactivateAccount(token) {
  return request('/users/me/deactivate', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
}

export function deleteAccount(password, token) {
  return request('/users/me', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ currentPassword: password }) })
}

export function uploadAvatar(file, token) {
  const body = new FormData()
  body.append('avatar', file)
  return request('/users/me/avatar', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body })
}

export function updateItemAvailability(id, active, token) {
  return request(`/items/${id}/availability`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ active }) })
}

export function reportItem(id, reason, token) {
  return request(`/items/${id}/reports`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ reason }) })
}

export function uploadItemImage(id, file, token) {
  const body = new FormData()
  body.append('image', file)
  return request(`/items/${id}/images`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body })
}

export function requestBookingExtension(id, endDate, token) {
  return request(`/bookings/${id}/extend`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ endDate }) })
}

export function decideBookingExtension(id, status, token) {
  return request(`/bookings/${id}/extend/status`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }) })
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
