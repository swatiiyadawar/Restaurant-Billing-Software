import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import authRoutes from './routes/authRoutes.js'
import dashboardRoutes from './routes/dashboardRoutes.js'
import menuRoutes from './routes/menuRoutes.js'
import tableRoutes from './routes/tableRoutes.js'
import orderRoutes from './routes/orderRoutes.js'
import billRoutes from './routes/billRoutes.js'
import paymentRoutes from './routes/paymentRoutes.js'
import reportRoutes from './routes/reportRoutes.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import { env } from './config/env.js'

const app = express()
app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }))
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())
app.get('/api/health', (_request, response) => response.json({ status: 'ok', service: 'dineflow-api' }))
app.use('/api/auth', authRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/menu', menuRoutes)
app.use('/api/tables', tableRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/bills', billRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/reports', reportRoutes)
app.use(notFound)
app.use(errorHandler)

export default app
