const REPORT_TIME_ZONE = 'Asia/Kolkata'

export function dateKey(date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: REPORT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function dayStart(key) { return new Date(`${key}T00:00:00.000+05:30`) }
function nextDay(key) { return new Date(dayStart(key).getTime() + 86400000) }

export function dateRange({ date, from, to } = {}) {
  const today = dateKey(new Date())
  const startKey = from || date || to || today
  const endKey = to || date || (from && from > today ? from : today)
  if (startKey > endKey) throw new RangeError('End date must be on or after start date')
  return { start: dayStart(startKey), end: nextDay(endKey), from: startKey, to: endKey }
}
