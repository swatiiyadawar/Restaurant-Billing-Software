import app from './app.js'
import { env } from './config/env.js'
import { connectDatabase, disconnectDatabase } from './config/database.js'

let server

async function start() {
  await connectDatabase()
  console.log('MongoDB connected')
  server = app.listen(env.PORT, () => console.log(`DineFlow API listening on http://localhost:${env.PORT}`))
}

async function shutdown(signal) {
  console.log(`${signal} received; closing server`)
  if (server) await new Promise((resolve) => server.close(resolve))
  await disconnectDatabase()
  process.exit(0)
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))

start().catch(async (error) => {
  console.error('Server startup failed:', error.message)
  await disconnectDatabase()
  process.exit(1)
})
