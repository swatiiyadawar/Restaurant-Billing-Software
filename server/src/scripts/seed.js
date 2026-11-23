import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../config/database.js'
import MenuItem from '../models/MenuItem.js'
import RestaurantTable from '../models/RestaurantTable.js'
import { MENU_CATEGORIES } from '../models/MenuItem.js'

const samples = {
  Starters: [['Paneer Tikka', 220, 'VEG'], ['Veg Spring Rolls', 160, 'VEG'], ['Chicken Tikka', 280, 'NON_VEG'], ['Crispy Corn', 180, 'VEG']],
  'Main Course': [['Paneer Butter Masala', 280, 'VEG'], ['Dal Makhani', 240, 'VEG'], ['Butter Chicken', 340, 'NON_VEG'], ['Veg Kadai', 250, 'VEG']],
  Breads: [['Butter Naan', 55, 'VEG'], ['Tandoori Roti', 35, 'VEG'], ['Garlic Naan', 70, 'VEG'], ['Lachha Paratha', 65, 'VEG']],
  Biryani: [['Veg Biryani', 240, 'VEG'], ['Chicken Biryani', 320, 'NON_VEG'], ['Paneer Biryani', 280, 'VEG'], ['Egg Biryani', 270, 'NON_VEG']],
  Beverages: [['Masala Chai', 45, 'VEG'], ['Fresh Lime Soda', 90, 'VEG'], ['Mango Lassi', 110, 'VEG'], ['Cold Coffee', 130, 'VEG']],
  Desserts: [['Gulab Jamun', 90, 'VEG'], ['Rasmalai', 120, 'VEG'], ['Chocolate Brownie', 150, 'VEG'], ['Kulfi', 85, 'VEG']],
}

try {
  await connectDatabase()
  for (const tableNumber of Array.from({ length: 10 }, (_, index) => `T${index + 1}`)) {
    await RestaurantTable.updateOne({ tableNumber }, { $setOnInsert: { tableNumber, status: 'FREE' } }, { upsert: true, runValidators: true })
  }
  for (const category of MENU_CATEGORIES) {
    for (const [name, price, foodType] of samples[category]) {
      await MenuItem.updateOne({ name, category }, { $setOnInsert: { name, category, price, foodType, available: true } }, { upsert: true, runValidators: true })
    }
  }
  console.log('Seed completed: 10 tables and 24 menu items. Create user accounts from the sign-up screen.')
} catch (error) {
  console.error('Seed failed:', error.message)
  process.exitCode = 1
} finally {
  await disconnectDatabase()
  await mongoose.disconnect()
}
