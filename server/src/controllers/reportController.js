import Bill from '../models/Bill.js'
import Order from '../models/Order.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { dateKey, dateRange } from '../utils/dateRange.js'

const REPORT_TIME_ZONE = 'Asia/Kolkata'
const PAYMENT_MODES = ['CASH', 'UPI', 'CARD']

const billFilter = ({ start, end }) => ({ createdAt: { $gte: start, $lt: end }, cancelled: false })

export const dashboard = asyncHandler(async (_request, response) => {
  const today = dateKey(new Date())
  const { start, end } = dateRange({ date: today })
  const filter = billFilter({ start, end })
  const [sales] = await Bill.aggregate([
    { $match: filter },
    { $group: { _id: null, totalBills: { $sum: 1 }, totalSales: { $sum: '$finalPayableAmount' } } },
    { $project: { totalBills: 1, totalSales: { $round: ['$totalSales', 2] } } },
  ])
  const weekStart = new Date(start.getTime() - 6 * 86400000)
  const [totalOrders, paymentRows, topSellingItems, trendRows] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: start, $lt: end }, status: { $ne: 'CANCELLED' } }),
    Bill.aggregate([{ $match: filter }, { $unwind: '$payments' }, { $group: { _id: '$payments.mode', amount: { $sum: '$payments.amount' } } }, { $project: { amount: { $round: ['$amount', 2] } } }]),
    Bill.aggregate([
      { $match: filter }, { $unwind: '$items' },
      { $group: { _id: '$items.name', quantity: { $sum: '$items.quantity' }, sales: { $sum: '$items.amount' } } },
      { $sort: { quantity: -1, sales: -1, _id: 1 } }, { $limit: 5 },
      { $project: { _id: 0, name: '$_id', quantity: 1, sales: { $round: ['$sales', 2] } } },
    ]),
    Bill.aggregate([
      { $match: { createdAt: { $gte: weekStart, $lt: end }, cancelled: false } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: REPORT_TIME_ZONE } }, sales: { $sum: '$finalPayableAmount' } } },
      { $project: { sales: { $round: ['$sales', 2] } } },
    ]),
  ])
  const payments = Object.fromEntries(PAYMENT_MODES.map((mode) => [mode, 0]))
  for (const row of paymentRows) payments[row._id] = row.amount
  const trendByDate = new Map(trendRows.map((row) => [row._id, row.sales]))
  const salesTrend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart.getTime() + index * 86400000)
    const label = dateKey(date)
    return { date: label, sales: trendByDate.get(label) || 0 }
  })
  response.json({ date: today, totalSales: sales?.totalSales || 0, totalBills: sales?.totalBills || 0, totalOrders, payments, topSellingItems, salesTrend })
})

export const salesReport = asyncHandler(async (request, response) => {
  const range = dateRange(request.validated.query)
  const filter = billFilter(range)
  const [summaryRows, paymentRows, itemRows, cancelledBills, totalOrders] = await Promise.all([
    Bill.aggregate([
      { $match: filter },
      { $group: { _id: null, bills: { $sum: 1 }, sales: { $sum: '$finalPayableAmount' }, subtotal: { $sum: '$subtotal' }, discounts: { $sum: '$discountAmount' }, cgst: { $sum: '$cgst' }, sgst: { $sum: '$sgst' } } },
      { $project: { bills: 1, sales: { $round: ['$sales', 2] }, subtotal: { $round: ['$subtotal', 2] }, discounts: { $round: ['$discounts', 2] }, cgst: { $round: ['$cgst', 2] }, sgst: { $round: ['$sgst', 2] } } },
    ]),
    Bill.aggregate([
      { $match: filter }, { $unwind: '$payments' },
      { $group: { _id: '$payments.mode', amount: { $sum: '$payments.amount' }, count: { $sum: 1 } } },
      { $project: { count: 1, amount: { $round: ['$amount', 2] } } },
    ]),
    Bill.aggregate([
      { $match: filter }, { $unwind: '$items' },
      { $group: { _id: '$items.name', quantity: { $sum: '$items.quantity' }, amount: { $sum: '$items.amount' } } },
      { $sort: { quantity: -1, amount: -1, _id: 1 } },
      { $project: { _id: 0, name: '$_id', quantity: 1, amount: { $round: ['$amount', 2] } } },
    ]),
    Bill.countDocuments({ createdAt: { $gte: range.start, $lt: range.end }, cancelled: true }),
    Order.countDocuments({ createdAt: { $gte: range.start, $lt: range.end }, status: { $ne: 'CANCELLED' } }),
  ])
  const summary = { bills: 0, sales: 0, subtotal: 0, discounts: 0, cgst: 0, sgst: 0, orders: totalOrders, cancelledBills, ...(summaryRows[0] || {}) }
  summary.orders = totalOrders
  summary.cancelledBills = cancelledBills
  const paymentBreakdown = Object.fromEntries(PAYMENT_MODES.map((mode) => [mode, 0]))
  for (const row of paymentRows) paymentBreakdown[row._id] = row.amount
  const paymentModes = PAYMENT_MODES.map((mode) => ({ mode, amount: paymentBreakdown[mode], count: paymentRows.find((row) => row._id === mode)?.count || 0 }))
  const dayEnd = { totalSales: summary.sales, bills: summary.bills, paymentBreakdown, bestSellingItems: itemRows.slice(0, 5) }
  response.json({ from: range.from, to: range.to, date: range.from === range.to ? range.from : undefined, summary, paymentModes, paymentBreakdown, items: itemRows, dayEnd })
})
