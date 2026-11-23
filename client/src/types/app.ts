export type Role = 'ADMIN' | 'CASHIER'

export interface User {
  _id: string
  name: string
  username: string
  email: string
  role: Role
}

export interface ApiError {
  error?: { message?: string; details?: Array<{ field: string; message: string }> }
}

export interface DashboardSummary {
  date: string
  totalSales: number
  totalBills: number
  totalOrders: number
  payments: { CASH: number; UPI: number; CARD: number }
  topSellingItems: Array<{ name: string; quantity: number; sales: number }>
  salesTrend: Array<{ date: string; sales: number }>
}

export interface Bill {
  _id: string
  billNumber: string
  finalPayableAmount: number
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID'
  cancelled?: boolean
  payments: Array<{ mode: 'CASH' | 'UPI' | 'CARD'; amount: number }>
  order?: { orderNumber: string; orderType: 'DINE_IN' | 'TAKEAWAY' }
  cashier?: { name: string }
  createdAt: string
}

export interface BillRecord extends Bill {
  items: Array<{ menuItem: string; name: string; price: number; quantity: number; amount: number }>
  subtotal: number
  discountType: 'PERCENT' | 'AMOUNT'
  discountValue: number
  discountAmount: number
  cgst: number
  sgst: number
  grandTotal: number
  roundOff: number
  paidTotal: number
  cancelled: boolean
  cancelledAt?: string | null
  cancelledBy?: { name: string; username?: string } | null
  order?: { _id?: string; orderNumber: string; orderType: 'DINE_IN' | 'TAKEAWAY'; table?: { tableNumber: string } | string | null }
  cashier?: { name: string; username?: string }
  payments: Array<{ _id?: string; mode: 'CASH' | 'UPI' | 'CARD'; amount: number; paidAt?: string; recordedBy?: { name: string } }>
}

export type MenuCategory = 'Starters' | 'Main Course' | 'Breads' | 'Biryani' | 'Beverages' | 'Desserts'

export interface MenuItem {
  _id: string
  name: string
  category: MenuCategory
  price: number
  foodType: 'VEG' | 'NON_VEG'
  available: boolean
}

export interface OrderItem {
  menuItem: string
  name: string
  price: number
  quantity: number
}

export interface OrderRecord {
  _id: string
  orderNumber: string
  orderType: 'DINE_IN' | 'TAKEAWAY'
  table: string | { _id: string; tableNumber: string } | null
  items: OrderItem[]
  status: 'OPEN' | 'COMPLETED' | 'CANCELLED'
  createdAt: string
}

export interface RestaurantTable {
  _id: string
  tableNumber: `T${number}`
  status: 'FREE' | 'RUNNING'
  currentOrder: null | { _id: string; orderNumber: string; orderType: 'DINE_IN' | 'TAKEAWAY'; status: OrderRecord['status']; itemCount: number; createdAt: string }
}
