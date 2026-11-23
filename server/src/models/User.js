import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { env } from '../config/env.js'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  username: { type: String, required: true, trim: true, lowercase: true, minlength: 3, maxlength: 40 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['ADMIN', 'CASHIER'], required: true },
}, { timestamps: true })

userSchema.index({ email: 1 }, { unique: true })
userSchema.index({ username: 1 }, { unique: true })
userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash)
}
userSchema.methods.toJSON = function toJSON() {
  const result = this.toObject()
  delete result.passwordHash
  delete result.__v
  return result
}

export async function hashPassword(password) {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS)
}

export default mongoose.model('User', userSchema)
