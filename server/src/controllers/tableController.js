import RestaurantTable from '../models/RestaurantTable.js'
import Order from '../models/Order.js'
import Bill from '../models/Bill.js'
import { AppError } from '../utils/appError.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const listTables = asyncHandler(async (_request, response) => {
  const tables = await RestaurantTable.find().collation({ locale: 'en', numericOrdering: true }).sort({ tableNumber: 1 })
  const runningTables = tables.filter((table) => table.status === 'RUNNING')
  if (!runningTables.length) return response.json({ tables: tables.map((table) => ({ ...table.toObject(), currentOrder: null })) })

  const orders = await Order.find({ table: { $in: runningTables.map((table) => table._id) }, status: { $in: ['OPEN', 'COMPLETED'] } }).sort({ createdAt: -1 }).lean()
  const bills = await Bill.find({ order: { $in: orders.map((order) => order._id) }, cancelled: false }).select('order paymentStatus').lean()
  const billByOrder = new Map(bills.map((bill) => [String(bill.order), bill]))
  const orderByTable = new Map()
  for (const order of orders) {
    const tableId = String(order.table)
    const bill = billByOrder.get(String(order._id))
    const active = order.status === 'OPEN' || (order.status === 'COMPLETED' && bill?.paymentStatus !== 'PAID')
    if (active && !orderByTable.has(tableId)) orderByTable.set(tableId, order)
  }

  response.json({ tables: tables.map((table) => {
    const currentOrder = orderByTable.get(String(table._id))
    return {
      ...table.toObject(),
      currentOrder: currentOrder ? { _id: currentOrder._id, orderNumber: currentOrder.orderNumber, orderType: currentOrder.orderType, status: currentOrder.status, itemCount: currentOrder.items.reduce((sum, item) => sum + item.quantity, 0), createdAt: currentOrder.createdAt } : null,
    }
  }) })
})

export const updateTable = asyncHandler(async (request, response) => {
  const { status } = request.validated.body
  const tableId = request.validated.params.id
  const exists = await RestaurantTable.exists({ _id: tableId })
  if (!exists) throw new AppError(404, 'Table not found')
  const openOrder = await Order.exists({ table: tableId, status: 'OPEN' })
  const completedOrders = await Order.find({ table: tableId, status: 'COMPLETED' }).select('_id').lean()
  const unpaidBill = completedOrders.length
    ? await Bill.exists({ order: { $in: completedOrders.map((order) => order._id) }, cancelled: false, paymentStatus: { $ne: 'PAID' } })
    : null
  const hasActiveOrder = Boolean(openOrder || unpaidBill)
  if (status === 'FREE' && hasActiveOrder) throw new AppError(409, 'A table with an unpaid active order cannot be marked free')
  if (status === 'RUNNING' && !hasActiveOrder) throw new AppError(409, 'A table cannot be marked running without an active order')
  const table = await RestaurantTable.findByIdAndUpdate(tableId, request.validated.body, { returnDocument: 'after', runValidators: true })
  if (!table) throw new AppError(404, 'Table not found')
  response.json({ table })
})
