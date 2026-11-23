import mongoose from 'mongoose'

export const MENU_CATEGORIES = ['Starters', 'Main Course', 'Breads', 'Biryani', 'Beverages', 'Desserts']
const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  category: { type: String, enum: MENU_CATEGORIES, required: true },
  price: { type: Number, required: true, min: 0.01, max: 100000 },
  foodType: { type: String, enum: ['VEG', 'NON_VEG'], required: true },
  available: { type: Boolean, default: true },
}, { timestamps: true })
menuItemSchema.index({ name: 1, category: 1 })

export default mongoose.model('MenuItem', menuItemSchema)
