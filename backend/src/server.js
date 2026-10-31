import 'dotenv/config'
import { app } from './app.js'
import { connectDatabase, disconnectDatabase } from './config/database.js'
import { validateEnvironment } from './config/env.js'
import { startJobs } from './jobs/index.js'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { registerSockets } from './sockets/index.js'

try {
  const environment = validateEnvironment()
  const port = environment.PORT

try {
  app.locals.database = await connectDatabase()
  app.locals.jobs = startJobs()
  const httpServer = createServer(app)
  const socketServer = new Server(httpServer, { cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:5173' } })
  registerSockets(socketServer)
  httpServer.listen(port, () => console.log(`Borrow Hub API listening on http://localhost:${port}`))
  const shutdown = async (signal) => {
    console.log(`Received ${signal}; shutting down gracefully.`)
    app.locals.jobs?.stop()
    await new Promise(resolve => httpServer.close(resolve))
    await socketServer.close()
    await disconnectDatabase()
  }
  process.once('SIGTERM', () => shutdown('SIGTERM').catch(error => { console.error('Graceful shutdown failed:', error); process.exitCode = 1 }))
  process.once('SIGINT', () => shutdown('SIGINT').catch(error => { console.error('Graceful shutdown failed:', error); process.exitCode = 1 }))
} catch (error) {
  console.error('Unable to connect to MongoDB. The API was not started.', error.message)
  process.exitCode = 1
}
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
