import { AppError } from '../utils/appError.js'

export function authorize(...allowedRoles) {
  return (request, _response, next) => {
    if (!request.user) return next(new AppError(401, 'Authentication required'))
    if (!allowedRoles.includes(request.user.role)) return next(new AppError(403, 'You do not have permission to perform this action'))
    next()
  }
}

export const adminOnly = authorize('ADMIN')
export const cashierOrAdmin = authorize('ADMIN', 'CASHIER')
