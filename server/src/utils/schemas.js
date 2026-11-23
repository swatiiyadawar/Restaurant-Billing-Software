import { z } from 'zod'
import { MENU_CATEGORIES } from '../models/MenuItem.js'

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid ID')
export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export const menuItemInput = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.enum(MENU_CATEGORIES),
  price: z.coerce.number().positive().max(100000),
  foodType: z.enum(['VEG', 'NON_VEG']),
  available: z.boolean().optional(),
})
export const orderInput = z.object({
  orderType: z.enum(['DINE_IN', 'TAKEAWAY']),
  table: objectId.nullable().optional(),
  items: z.array(z.object({ menuItem: objectId, quantity: z.coerce.number().int().min(1).max(999) })).min(1).max(100),
}).superRefine((data, context) => {
  if (data.orderType === 'DINE_IN' && !data.table) context.addIssue({ code: 'custom', path: ['table'], message: 'A table is required for dine-in orders' })
  if (data.orderType === 'TAKEAWAY' && data.table) context.addIssue({ code: 'custom', path: ['table'], message: 'Takeaway orders cannot have a table' })
})
export const billInput = z.object({
  order: objectId,
  discountType: z.enum(['PERCENT', 'AMOUNT']).default('AMOUNT'),
  discountValue: z.coerce.number().min(0).default(0),
}).superRefine((data, context) => {
  if (data.discountType === 'PERCENT' && data.discountValue > 100) context.addIssue({ code: 'custom', path: ['discountValue'], message: 'Percentage cannot exceed 100' })
})
const singlePaymentInput = z.object({
  bill: objectId,
  mode: z.enum(['CASH', 'UPI', 'CARD']),
  amount: z.coerce.number().positive().max(10000000),
})
const splitPaymentInput = z.object({
  bill: objectId,
  payments: z.array(z.object({ mode: z.enum(['CASH', 'UPI', 'CARD']), amount: z.coerce.number().positive().max(10000000) })).min(1).max(10),
})
export const paymentInput = z.union([singlePaymentInput, splitPaymentInput])
export const idParams = z.object({ id: objectId })
export const loginInput = z.object({
  identity: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
  role: z.enum(['ADMIN', 'CASHIER']),
})
export const registerInput = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().max(254),
  username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/, 'Use letters, numbers, dots, underscores, or hyphens'),
  password: z.string().min(12).max(128),
  role: z.enum(['ADMIN', 'CASHIER']),
})
export const menuQuery = pagination.extend({
  search: z.string().trim().max(100).optional(),
  category: z.enum(MENU_CATEGORIES).optional(),
  available: z.enum(['true', 'false']).optional(),
})
const dateQuery = {
  date: z.iso.date().optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
}
const checkDateRange = (data, context) => {
  if (data.from && data.to && data.from > data.to) context.addIssue({ code: 'custom', path: ['to'], message: 'End date must be on or after start date' })
  if (data.date && (data.from || data.to)) context.addIssue({ code: 'custom', path: ['date'], message: 'Use either a single date or a date range' })
}

export const billQuery = pagination.extend({
  search: z.string().trim().max(40).optional(),
  paymentMode: z.enum(['CASH', 'UPI', 'CARD']).optional(),
  cancelled: z.enum(['true', 'false']).optional(),
  ...dateQuery,
}).superRefine(checkDateRange)
export const reportQuery = z.object(dateQuery).superRefine(checkDateRange)
