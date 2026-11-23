import mongoose from 'mongoose'

const billItemSchema = new mongoose.Schema({
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
  amount: { type: Number, required: true, min: 0 },
}, { _id: false })

const paymentSchema = new mongoose.Schema({
  mode: { type: String, enum: ['CASH', 'UPI', 'CARD'], required: true },
  amount: { type: Number, required: true, min: 0.01 },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  paidAt: { type: Date, default: Date.now },
}, { _id: true })

const billSchema = new mongoose.Schema({
  billNumber: { type: String, required: true, unique: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  items: { type: [billItemSchema], required: true },
  subtotal: { type: Number, required: true, min: 0 },
  discountType: { type: String, enum: ['PERCENT', 'AMOUNT'], default: 'AMOUNT' },
  discountValue: { type: Number, min: 0, default: 0 },
  discountAmount: { type: Number, required: true, min: 0 },
  cgst: { type: Number, required: true, min: 0 },
  sgst: { type: Number, required: true, min: 0 },
  grandTotal: { type: Number, required: true, min: 0 },
  roundOff: { type: Number, required: true },
  finalPayableAmount: { type: Number, required: true, min: 0 },
  paidTotal: { type: Number, default: 0, min: 0 },
  paymentStatus: { type: String, enum: ['UNPAID', 'PARTIAL', 'PAID'], default: 'UNPAID', required: true },
  payments: { type: [paymentSchema], default: [] },
  cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cancelled: { type: Boolean, default: false, required: true },
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true })

billSchema.index({ createdAt: -1, paymentStatus: 1, cancelled: 1 })
export default mongoose.model('Bill', billSchema)
