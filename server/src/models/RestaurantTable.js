import mongoose from 'mongoose'

const tableSchema = new mongoose.Schema({
  tableNumber: { type: String, required: true, enum: Array.from({ length: 10 }, (_, index) => `T${index + 1}`), unique: true },
  status: { type: String, enum: ['FREE', 'RUNNING'], default: 'FREE', required: true },
}, { timestamps: true })

export default mongoose.model('RestaurantTable', tableSchema)
