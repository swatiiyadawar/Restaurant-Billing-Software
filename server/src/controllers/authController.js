import jwt from 'jsonwebtoken'
import User, { hashPassword } from '../models/User.js'
import { env } from '../config/env.js'
import { AppError } from '../utils/appError.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const login = asyncHandler(async (request, response) => {
  const { identity, password, role } = request.validated.body
  const user = await User.findOne({ $or: [{ username: identity.toLowerCase() }, { email: identity.toLowerCase() }] }).select('+passwordHash')
  if (!user || !(await user.comparePassword(password))) throw new AppError(401, 'Invalid username/email or password')
  if (user.role !== role) throw new AppError(403, `This account is not registered as ${role === 'ADMIN' ? 'an Admin' : 'a Cashier'}`)

  const token = jwt.sign({ role: user.role }, env.JWT_SECRET, { subject: user.id, expiresIn: env.JWT_EXPIRES_IN, algorithm: 'HS256' })
  response.cookie('dineflow_token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  })
  response.json({ user })
})

export const register = asyncHandler(async (request, response) => {
  const { name, email, username, password, role: requestedRole } = request.validated.body
  const hasAdmin = await User.exists({ role: 'ADMIN' })
  if (requestedRole === 'ADMIN' && hasAdmin) {
    throw new AppError(403, 'This workspace already has an Admin account. Admin sign-up is closed. Choose Cashier to create a cashier account, or sign in to the existing Admin account.')
  }
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    username: username.toLowerCase(),
    passwordHash: await hashPassword(password),
    role: requestedRole === 'ADMIN' && !hasAdmin ? 'ADMIN' : 'CASHIER',
  })
  const token = jwt.sign({ role: user.role }, env.JWT_SECRET, { subject: user.id, expiresIn: env.JWT_EXPIRES_IN, algorithm: 'HS256' })
  response.cookie('dineflow_token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  })
  response.status(201).json({ user })
})

export const currentUser = asyncHandler(async (request, response) => {
  response.json({ user: request.user })
})

export function logout(_request, response) {
  response.clearCookie('dineflow_token', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  })
  response.status(204).end()
}
