import mongoose from 'mongoose'
import { AppError } from '../utils/appError.js'

export function notFound(request, _response, next) {
  next(new AppError(404, `Route ${request.method} ${request.originalUrl} was not found`))
}

export function errorHandler(error, _request, response, _next) {
  let statusCode = error.statusCode || 500
  let message = error.isOperational ? error.message : 'Internal server error'
  let details = error.isOperational ? error.details : undefined

  if (error instanceof mongoose.Error.ValidationError) {
    statusCode = 400
    message = 'Data validation failed'
    details = Object.values(error.errors).map((item) => ({ field: item.path, message: item.message }))
  } else if (error instanceof mongoose.Error.CastError) {
    statusCode = 400
    message = 'Invalid identifier'
  } else if (error?.code === 11000) {
    statusCode = 409
    message = 'A record with this value already exists'
    details = Object.keys(error.keyPattern || {}).map((field) => ({ field, message: 'Must be unique' }))
  } else if (error?.type === 'entity.parse.failed') {
    statusCode = 400
    message = 'Malformed JSON request body'
  } else if (error?.type === 'entity.too.large') {
    statusCode = 413
    message = 'Request body is too large'
  }

  if (statusCode >= 500) console.error('Request failed', { name: error.name, message: error.message })
  response.status(statusCode).json({ error: { message, ...(details ? { details } : {}) } })
}
