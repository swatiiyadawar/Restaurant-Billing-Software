import Bill from '../models/Bill.js'
import Order from '../models/Order.js'
import RestaurantTable from '../models/RestaurantTable.js'
import { AppError } from '../utils/appError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { formatSequence, nextSequence } from '../utils/sequence.js'
import { calculateBillAmounts, fromPaise, toPaise } from '../utils/money.js'
import { dateRange } from '../utils/dateRange.js'

export const createBill = asyncHandler(async (request, response) => {
  const { order: orderId, discountType, discountValue } = request.validated.body
  const order = await Order.findById(orderId)
  if (!order) throw new AppError(404, 'Order not found')
  if (order.status !== 'OPEN') throw new AppError(409, 'Only open orders can be billed')

  if (await Bill.exists({ order: order._id })) throw new AppError(409, 'A bill already exists for this order')
  const amounts = calculateBillAmounts(order.items, discountType, discountValue)
  const billNumber = formatSequence('BILL', await nextSequence('bill'))

  const bill = await Bill.create({
    billNumber, order: order._id,
    items: order.items.map((item, index) => ({ menuItem: item.menuItem, name: item.name, price: item.price, quantity: item.quantity, amount: amounts.itemAmounts[index] })),
    subtotal: amounts.subtotal, discountType, discountValue, discountAmount: amounts.discountAmount,
    cgst: amounts.cgst, sgst: amounts.sgst, grandTotal: amounts.grandTotal,
    roundOff: amounts.roundOff, finalPayableAmount: amounts.finalPayableAmount,
    ...(amounts.finalPayableAmount === 0 ? { paymentStatus: 'PAID' } : {}),
    cashier: request.user._id,
  })
  order.status = 'COMPLETED'
  await order.save()
  response.status(201).json({ bill })
})

export const listBills = asyncHandler(async (request, response) => {
  const { page, limit, search, paymentMode, cancelled, date, from, to } = request.validated.query
  const filter = {}
  if (search) filter.billNumber = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
  if (paymentMode) filter.payments = { $elemMatch: { mode: paymentMode } }
  if (cancelled !== undefined) filter.cancelled = cancelled === 'true'
  if (date || from || to) {
    const range = dateRange({ date, from, to })
    filter.createdAt = { $gte: range.start, $lt: range.end }
  }
  const [bills, total] = await Promise.all([
    Bill.find(filter).populate('order', 'orderNumber orderType table').populate('cashier', 'name username').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Bill.countDocuments(filter),
  ])
  response.json({ bills, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
})

export const getBill = asyncHandler(async (request, response) => {
  const bill = await Bill.findById(request.validated.params.id)
    .populate({ path: 'order', select: 'orderNumber orderType table', populate: { path: 'table', select: 'tableNumber' } })
    .populate('cashier', 'name username')
    .populate('payments.recordedBy', 'name username')
    .populate('cancelledBy', 'name username')
  if (!bill) throw new AppError(404, 'Bill not found')
  response.json({ bill })
})

export const cancelBill = asyncHandler(async (request, response) => {
  const bill = await Bill.findById(request.validated.params.id)
  if (!bill) throw new AppError(404, 'Bill not found')
  if (bill.cancelled) throw new AppError(409, 'Bill is already cancelled')
  bill.cancelled = true
  bill.cancelledAt = new Date()
  bill.cancelledBy = request.user._id
  await bill.save()
  const order = await Order.findById(bill.order)
  if (order) {
    order.status = 'CANCELLED'
    await order.save()
    if (order.table) await RestaurantTable.findByIdAndUpdate(order.table, { status: 'FREE' })
  }
  response.json({ bill })
})

export const addPayment = asyncHandler(async (request, response) => {
  const body = request.validated.body
  const entries = body.payments || [{ mode: body.mode, amount: body.amount }]
  const bill = await recordPayments(body.bill, entries, request.user._id, Boolean(body.payments))
  response.status(201).json({ bill })
})

async function recordPayments(billId, entries, cashierId, mustSettle) {
  const totalPaise = entries.reduce((sum, entry) => sum + toPaise(entry.amount), 0n)
  if (totalPaise <= 0n) throw new AppError(400, 'Payment amount must be greater than zero')
  const payments = entries.map((entry) => ({ mode: entry.mode, amount: fromPaise(toPaise(entry.amount)), recordedBy: cashierId, paidAt: new Date() }))

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await Bill.findById(billId)
    if (!current) throw new AppError(404, 'Bill not found')
    if (current.cancelled) throw new AppError(409, 'Cancelled bills cannot receive payments')
    if (current.paymentStatus === 'PAID') throw new AppError(409, 'Bill is already paid')
    const paidPaise = toPaise(current.paidTotal || 0)
    const payablePaise = toPaise(current.finalPayableAmount)
    const outstandingPaise = payablePaise - paidPaise
    if (mustSettle && totalPaise !== outstandingPaise) throw new AppError(400, 'Split payment entries must equal the outstanding balance')
    if (totalPaise > outstandingPaise) throw new AppError(409, 'Payment exceeds the outstanding balance')
    const nextPaidPaise = paidPaise + totalPaise
    const paid = nextPaidPaise === payablePaise
    const updated = await Bill.findOneAndUpdate(
      { _id: billId, cancelled: false, paidTotal: current.paidTotal || 0, paymentStatus: current.paymentStatus },
      { $set: { paidTotal: fromPaise(nextPaidPaise), paymentStatus: paid ? 'PAID' : 'PARTIAL' }, $push: { payments: { $each: payments } } },
      { returnDocument: 'after' },
    )
    if (!updated) continue
    if (paid) {
      const order = await Order.findById(updated.order)
      if (order?.table) await RestaurantTable.findByIdAndUpdate(order.table, { status: 'FREE' })
    }
    return updated
  }
  throw new AppError(409, 'The bill changed while recording payment. Please retry.')
}

export const listPayments = asyncHandler(async (request, response) => {
  const page = Number(request.query.page) || 1
  const limit = Math.min(Number(request.query.limit) || 20, 100)
  const bills = await Bill.find({ 'payments.0': { $exists: true } }).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).select('billNumber payments paymentStatus')
  response.json({ payments: bills.flatMap((bill) => bill.payments.map((payment) => ({ ...payment.toObject(), bill: bill._id, billNumber: bill.billNumber }))) })
})
