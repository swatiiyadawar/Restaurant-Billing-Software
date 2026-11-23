import MenuItem from '../models/MenuItem.js'
import Order from '../models/Order.js'
import RestaurantTable from '../models/RestaurantTable.js'
import { AppError } from '../utils/appError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { formatSequence, nextSequence } from '../utils/sequence.js'

async function snapshotOrderItems(lines, existingItems = []) {
  const previousSnapshots = new Map(existingItems.map((item) => [String(item.menuItem), item]))
  const newIds = [...new Set(lines.map((line) => String(line.menuItem)).filter((id) => !previousSnapshots.has(id)))]
  const menuItems = await MenuItem.find({ _id: { $in: newIds }, available: true })
  if (menuItems.length !== newIds.length) throw new AppError(400, 'One or more menu items do not exist or are unavailable')
  const currentItems = new Map(menuItems.map((item) => [item.id, item]))
  return lines.map(({ menuItem, quantity }) => {
    const key = String(menuItem)
    const snapshot = previousSnapshots.get(key)
    if (snapshot) return { menuItem: snapshot.menuItem, name: snapshot.name, price: snapshot.price, quantity }
    const item = currentItems.get(key)
    return { menuItem: item.id, name: item.name, price: item.price, quantity }
  })
}

export const listOrders = asyncHandler(async (request, response) => {
  const page = Number(request.query.page) || 1
  const limit = Math.min(Number(request.query.limit) || 20, 100)
  const filter = request.query.status ? { status: request.query.status } : {}
  const [orders, total] = await Promise.all([
    Order.find(filter).populate('table', 'tableNumber').populate('cashier', 'name username').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ])
  response.json({ orders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
})

export const getOrder = asyncHandler(async (request, response) => {
  const order = await Order.findById(request.validated.params.id).populate('table', 'tableNumber').populate('cashier', 'name username')
  if (!order) throw new AppError(404, 'Order not found')
  response.json({ order })
})

export const createOrder = asyncHandler(async (request, response) => {
  const data = request.validated.body
  const items = await snapshotOrderItems(data.items)
  let table = null
  if (data.orderType === 'DINE_IN') {
    table = await RestaurantTable.findOneAndUpdate({ _id: data.table, status: 'FREE' }, { $set: { status: 'RUNNING' } }, { returnDocument: 'after' })
    if (!table) {
      const exists = await RestaurantTable.exists({ _id: data.table })
      if (!exists) throw new AppError(404, 'Table not found')
      throw new AppError(409, 'Table already has an active order')
    }
  }
  let order
  try {
    const orderNumber = formatSequence('ORD', await nextSequence('order'))
    order = await Order.create({ orderNumber, table: table?._id || null, orderType: data.orderType, items, cashier: request.user._id })
  } catch (error) {
    if (table) await RestaurantTable.findByIdAndUpdate(table._id, { status: 'FREE' })
    throw error
  }
  response.status(201).json({ order })
})

export const updateOrder = asyncHandler(async (request, response) => {
  const data = request.validated.body
  const order = await Order.findById(request.validated.params.id)
  if (!order) throw new AppError(404, 'Order not found')
  if (order.status !== 'OPEN') throw new AppError(409, 'Only open orders can be edited')
  const items = await snapshotOrderItems(data.items, order.items)
  order.items = items
  await order.save()
  response.json({ order })
})

export const cancelOrder = asyncHandler(async (request, response) => {
  const order = await Order.findById(request.validated.params.id)
  if (!order) throw new AppError(404, 'Order not found')
  if (order.status !== 'OPEN') throw new AppError(409, 'Only open orders can be cancelled')
  order.status = 'CANCELLED'
  await order.save()
  if (order.table) await RestaurantTable.findByIdAndUpdate(order.table, { status: 'FREE' })
  response.json({ order })
})
