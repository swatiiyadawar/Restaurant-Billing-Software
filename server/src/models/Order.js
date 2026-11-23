import mongoose from 'mongoose'

const orderItemSchema = new mongoose.Schema({
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0.01 },
  quantity: { type: Number, required: true, min: 1, max: 999 },
}, { _id: false })

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  table: { type: mongoose.Schema.Types.ObjectId, ref: 'RestaurantTable', default: null },
  orderType: { type: String, enum: ['DINE_IN', 'TAKEAWAY'], required: true },
  items: { type: [orderItemSchema], required: true, validate: [(items) => items.length > 0, 'Order must contain at least one item'] },
  status: { type: String, enum: ['OPEN', 'COMPLETED', 'CANCELLED'], default: 'OPEN', required: true },
  cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

orderSchema.index({ createdAt: -1, status: 1 })
export default mongoose.model('Order', orderSchema)
