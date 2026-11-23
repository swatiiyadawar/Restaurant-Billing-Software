function expandDecimal(value) {
  const source = String(value).trim()
  const match = source.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i)
  if (!match) throw new TypeError('Invalid monetary value')
  const [, sign, whole, fraction = '', exponentText = '0'] = match
  const digits = `${whole}${fraction}`
  const point = whole.length + Number(exponentText)
  const expanded = point <= 0 ? `0.${'0'.repeat(-point)}${digits}` : point >= digits.length ? `${digits}${'0'.repeat(point - digits.length)}` : `${digits.slice(0, point)}.${digits.slice(point)}`
  return { sign: sign === '-' ? -1n : 1n, expanded }
}

function scaledInteger(value, decimalPlaces) {
  const { sign, expanded } = expandDecimal(value)
  const [whole, fraction = ''] = expanded.split('.')
  const kept = fraction.slice(0, decimalPlaces).padEnd(decimalPlaces, '0')
  const discarded = fraction.slice(decimalPlaces)
  let result = BigInt(whole || '0') * (10n ** BigInt(decimalPlaces)) + BigInt(kept || '0')
  if (discarded && Number(discarded[0]) >= 5) result += 1n
  return result * sign
}

export const toPaise = (rupees) => scaledInteger(rupees, 2)
export const toBasisPoints = (percentage) => scaledInteger(percentage, 2)
export const fromPaise = (paise) => Number(paise) / 100
export const multiplyPaise = (unitPricePaise, quantity) => unitPricePaise * BigInt(quantity)
export const percentOfPaise = (amountPaise, basisPoints) => (amountPaise * basisPoints + 5000n) / 10000n
export const roundPaiseToRupee = (amountPaise) => ((amountPaise + 50n) / 100n) * 100n

export function calculateBillAmounts(items, discountType, discountValue) {
  const subtotalPaise = items.reduce((sum, item) => sum + multiplyPaise(toPaise(item.price), item.quantity), 0n)
  const requestedDiscountPaise = discountType === 'PERCENT'
    ? percentOfPaise(subtotalPaise, toBasisPoints(discountValue))
    : toPaise(discountValue)
  const discountPaise = requestedDiscountPaise > subtotalPaise ? subtotalPaise : requestedDiscountPaise
  const taxablePaise = subtotalPaise - discountPaise
  const cgstPaise = percentOfPaise(taxablePaise, 250n)
  const sgstPaise = percentOfPaise(taxablePaise, 250n)
  const grandTotalPaise = taxablePaise + cgstPaise + sgstPaise
  const payablePaise = roundPaiseToRupee(grandTotalPaise)
  return {
    subtotal: fromPaise(subtotalPaise),
    discountAmount: fromPaise(discountPaise),
    cgst: fromPaise(cgstPaise),
    sgst: fromPaise(sgstPaise),
    grandTotal: fromPaise(grandTotalPaise),
    roundOff: fromPaise(payablePaise - grandTotalPaise),
    finalPayableAmount: fromPaise(payablePaise),
    itemAmounts: items.map((item) => fromPaise(multiplyPaise(toPaise(item.price), item.quantity))),
  }
}
