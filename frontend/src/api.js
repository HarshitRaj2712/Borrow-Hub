const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'


let refreshPromise = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const storedSession = localStorage.getItem('borrow-hub-session');

      if (!storedSession) {
        throw new Error('No saved session found');
      }

      const session = JSON.parse(storedSession);

      if (!session.refreshToken) {
        throw new Error('No refresh token found');
      }

      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refreshToken: session.refreshToken
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Session refresh failed');
      }

      const updatedSession = {
        ...session,
        ...payload.data
      };

      localStorage.setItem(
        'borrow-hub-session',
        JSON.stringify(updatedSession)
      );

      return updatedSession.token;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function request(path, options = {}, retry = true) {
  const isFormData =
    typeof FormData !== 'undefined' &&
    options.body instanceof FormData;

  const headers = {
    ...(options.body && !isFormData
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(options.headers || {})
  };

  let response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  // If an authenticated request returns 401, try refreshing the token.
  if (
    response.status === 401 &&
    retry &&
    headers.Authorization &&
    path !== '/auth/refresh'
  ) {
    try {
      const newToken = await refreshAccessToken();

      return request(
        path,
        {
          ...options,
          headers: {
            ...headers,
            Authorization: `Bearer ${newToken}`
          }
        },
        false
      );
    } catch (error) {
      localStorage.removeItem('borrow-hub-session');

      if (
        window.location.pathname !== '/signin' &&
        window.location.pathname !== '/signup'
      ) {
        window.location.href = '/signin';
      }

      throw new Error('Your session has expired. Please sign in again.');
    }
  }

  const payload =
    response.status === 204 ? null : await response.json();

  if (!response.ok) {
    throw new Error(payload?.error || 'Request failed');
  }

  return payload;
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

export function updateItem(id, input, token) {
  return request(`/items/${id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(input) })
}

export function deleteItem(id, token) {
  return request(`/items/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
}

export function updateItemAvailability(id, active, token) {
  return request(`/items/${id}/availability`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ active }) })
}

export function registerUser(input, profileImage) {
  if (!profileImage) return request('/auth/register', { method: 'POST', body: JSON.stringify(input) })
  const body = new FormData()
  Object.entries(input).forEach(([key, value]) => body.append(key, value))
  body.append('profileImage', profileImage)
  return request('/auth/register', { method: 'POST', body })
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

export function listRecommendations(token) {
  return request('/recommendations', { headers: { Authorization: `Bearer ${token}` } })
}

export function listTrendingItems() {
  return request('/recommendations/trending')
}

export function listSimilarItems(itemId) {
  return request(`/recommendations/similar/${itemId}`)
}

export function listWishlist(token) {
  return request('/recommendations/wishlist', { headers: { Authorization: `Bearer ${token}` } })
}

export function recordItemActivity(itemId, token) {
  return request(`/recommendations/activity/${itemId}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
}

export function addToWishlist(itemId, token) {
  return request(`/recommendations/wishlist/${itemId}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
}

export function removeFromWishlist(itemId, token) {
  return request(`/recommendations/wishlist/${itemId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
}

export function listDisputes(token) {
  return request('/disputes', { headers: { Authorization: `Bearer ${token}` } })
}

export function openDispute(bookingId, input, token) {
  return request(`/disputes/bookings/${bookingId}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(input) })
}

export function listNotifications(token) {
  return request('/notifications', { headers: { Authorization: `Bearer ${token}` } })
}

export function markNotificationRead(id, token) {
  return request(`/notifications/${id}/read`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
}
