import jwt from 'jsonwebtoken'

export function registerSockets(io) {
  if (!io || typeof io.on !== 'function') throw new TypeError('A Socket.IO server is required')
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token
      const secret = process.env.JWT_SECRET?.trim()
      if (!token || !secret) return next(new Error('Authentication required'))
      socket.user = jwt.verify(token, secret)
      next()
    } catch {
      next(new Error('Invalid or expired token'))
    }
  })
  io.on('connection', socket => {
    socket.emit('connected', { service: 'borrow-hub' })
    socket.on('typing', payload => socket.broadcast.emit('typing', { ...payload, userId: socket.user.sub }))
    socket.on('read', payload => socket.broadcast.emit('read', { ...payload, userId: socket.user.sub }))
  })
  return io
}
