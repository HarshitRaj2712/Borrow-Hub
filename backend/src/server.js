import 'dotenv/config'
import { app } from './app.js'
import { connectDatabase } from './config/database.js'

const port = process.env.PORT || 4000

try {
  app.locals.database = await connectDatabase()
  app.listen(port, () => console.log(`Borrow Hub API listening on http://localhost:${port}`))
} catch (error) {
  console.error('Unable to connect to MongoDB. The API was not started.', error.message)
  process.exitCode = 1
}
