import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { env } from '../config/env.js'
import { AppError } from '../utils/appError.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const authenticate = asyncHandler(async (request, _response, next) => {
  const [scheme, bearerToken] = (request.headers.authorization || '').split(' ')
  const token = scheme === 'Bearer' && bearerToken ? bearerToken : request.cookies?.dineflow_token
  if (!token) throw new AppError(401, 'Authentication required')

  let claims
  try {
    claims = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] })
  } catch {
    throw new AppError(401, 'Invalid or expired authentication token')
  }
  if (!claims.sub) throw new AppError(401, 'Invalid authentication token')

  const user = await User.findById(claims.sub).select('name email username role')
  if (!user) throw new AppError(401, 'Authentication required')
  request.user = user
  next()
})
