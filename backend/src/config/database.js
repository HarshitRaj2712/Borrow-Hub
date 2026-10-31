import mongoose from 'mongoose'
import '../models/index.js'

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI?.trim()
  if (!uri) {
    throw new Error('MONGODB_URI is required. Configure backend/.env before starting the API.')
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000
  })
  console.log(`MongoDB connected to ${mongoose.connection.host}`)
  return { connected: true, mode: 'mongodb' }
}

export async function disconnectDatabase() {
  await mongoose.disconnect()
}
