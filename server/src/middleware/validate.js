import { AppError } from '../utils/appError.js'

export function validate(schema) {
  return (request, _response, next) => {
    const result = schema.safeParse({ body: request.body, params: request.params, query: request.query })
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }))
      return next(new AppError(400, 'Request validation failed', details))
    }
    request.validated = result.data
    next()
  }
}
