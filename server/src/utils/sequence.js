import Counter from '../models/Counter.js'

export async function nextSequence(name) {
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { sequence: 1 } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
  )
  return counter.sequence
}

export function formatSequence(prefix, value, width = 6) {
  return `${prefix}-${String(value).padStart(width, '0')}`
}
