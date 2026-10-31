import 'dotenv/config'
import { app } from './app.js'
import { connectDatabase } from './config/database.js'
import { startJobs } from './jobs/index.js'

const port = process.env.PORT || 4000

if (!process.env.JWT_SECRET?.trim() || process.env.JWT_SECRET.trim().length < 64) {
  console.error('Unable to start the API. JWT_SECRET must be at least 64 characters.')
  process.exitCode = 1
} else {

try {
  app.locals.database = await connectDatabase()
  app.locals.jobs = startJobs()
  app.listen(port, () => console.log(`Borrow Hub API listening on http://localhost:${port}`))
} catch (error) {
  console.error('Unable to connect to MongoDB. The API was not started.', error.message)
  process.exitCode = 1
}
}
