import MenuItem from '../models/MenuItem.js'
import { AppError } from '../utils/appError.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const listMenu = asyncHandler(async (request, response) => {
  const { page, limit, search, category, available } = request.validated.query
  const filter = {}
  if (search) filter.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
  if (category) filter.category = category
  if (available !== undefined) filter.available = available === 'true'
  const [items, total] = await Promise.all([
    MenuItem.find(filter).sort({ category: 1, name: 1 }).skip((page - 1) * limit).limit(limit),
    MenuItem.countDocuments(filter),
  ])
  response.json({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
})

export const createMenuItem = asyncHandler(async (request, response) => {
  const item = await MenuItem.create(request.validated.body)
  response.status(201).json({ item })
})

export const updateMenuItem = asyncHandler(async (request, response) => {
  const item = await MenuItem.findByIdAndUpdate(request.validated.params.id, request.validated.body, { returnDocument: 'after', runValidators: true, context: 'query' })
  if (!item) throw new AppError(404, 'Menu item not found')
  response.json({ item })
})

export const deleteMenuItem = asyncHandler(async (request, response) => {
  const item = await MenuItem.findByIdAndDelete(request.validated.params.id)
  if (!item) throw new AppError(404, 'Menu item not found')
  response.status(204).end()
})
