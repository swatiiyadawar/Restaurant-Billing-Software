import mongoose from 'mongoose'
import { env } from './env.js'

export function assertConfiguredMongoUri(uri) {
  if (uri.includes('<') || uri.includes('>') || uri.includes('cluster-url')) {
    throw new Error('MONGODB_URI still contains example placeholders. Replace it in server/.env with the connection string from your MongoDB Atlas cluster.')
  }
}

export async function connectDatabase() {
  assertConfiguredMongoUri(env.MONGODB_URI)
  mongoose.set('strictQuery', true)
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  return mongoose.connection
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
}
