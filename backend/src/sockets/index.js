export function registerSockets(io) {
  if (!io || typeof io.on !== 'function') throw new TypeError('A Socket.IO server is required')
  io.on('connection', socket => socket.emit('connected', { service: 'borrow-hub' }))
  return io
}
