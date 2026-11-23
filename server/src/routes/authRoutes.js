import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { currentUser, login, logout, register } from '../controllers/authController.js'
import { authenticate } from '../middleware/authenticate.js'
import { validate } from '../middleware/validate.js'
import { loginInput, registerInput } from '../utils/schemas.js'

const router = Router()
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { message: 'Too many login attempts. Try again later.' } } })
const registrationLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { message: 'Too many account creation attempts. Try again later.' } } })

router.post('/login', loginLimiter, validate(z.object({ body: loginInput })), login)
router.post('/register', registrationLimiter, validate(z.object({ body: registerInput })), register)
router.get('/me', authenticate, currentUser)
router.get('/session', (request, response, next) => {
  if (!request.cookies?.dineflow_token && !request.headers.authorization) return response.json({ user: null })
  authenticate(request, response, (error) => {
    if (error?.statusCode === 401) {
      response.clearCookie('dineflow_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' })
      return response.json({ user: null })
    }
    if (error) return next(error)
    currentUser(request, response, next)
  })
})
router.post('/logout', logout)

export default router
