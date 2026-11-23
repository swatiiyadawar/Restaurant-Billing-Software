import { useMemo, useState } from 'react'
import { Plus, Printer, ReceiptText, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../services/api'
import type { BillRecord } from '../types/app'
import { Badge, Button, Card } from './ui'

const currency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount)
const toCents = (value: string) => {
  if (!/^\d+(?:\.\d{0,2})?$/.test(value)) return null
  const [rupees, paise = ''] = value.split('.')
  return Number(rupees) * 100 + Number(paise.padEnd(2, '0'))
}
type PaymentLine = { mode: 'CASH' | 'UPI' | 'CARD'; amount: string }

export function BillPanel({ bill, onUpdated }: { bill: BillRecord; onUpdated: () => void }) {
  const [lines, setLines] = useState<PaymentLine[]>([{ mode: 'CASH', amount: '' }])
  const [savingPayment, setSavingPayment] = useState(false)
  const paidCents = toCents(String(bill.paidTotal || 0)) || 0
  const payableCents = toCents(String(bill.finalPayableAmount)) || 0
  const outstandingCents = payableCents - paidCents
  const enteredCents = useMemo(() => lines.reduce((sum, line) => sum + (toCents(line.amount) ?? 0), 0), [lines])
  const table = bill.order?.table && typeof bill.order.table === 'object' ? bill.order.table.tableNumber : null

  async function submitPayment() {
    const amounts = lines.map((line) => toCents(line.amount))
    if (amounts.some((amount) => amount === null || amount <= 0)) { toast.error('Enter a valid amount for every payment.'); return }
    if (enteredCents !== outstandingCents) { toast.error(`Payment entries must total ${currency(outstandingCents / 100)}.`); return }
    setSavingPayment(true)
    try {
      await api.post('/payments', { bill: bill._id, payments: lines.map((line, index) => ({ mode: line.mode, amount: (amounts[index] as number) / 100 })) })
      toast.success('Payment confirmed. Bill marked as paid.')
      setLines([{ mode: 'CASH', amount: '' }])
      onUpdated()
    } catch (request) {
      const message = (request as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message || 'Payment could not be recorded.'
      toast.error(message)
    } finally { setSavingPayment(false) }
  }

  return <div className="bill-panel">
    <div className="bill-panel-actions"><div><Badge tone={bill.paymentStatus === 'PAID' ? 'success' : bill.paymentStatus === 'PARTIAL' ? 'warning' : 'neutral'}>{bill.cancelled ? 'Cancelled' : bill.paymentStatus}</Badge><span>{bill.billNumber}</span></div><Button className="button-secondary" onClick={() => window.print()}><Printer size={15} />Print / Save PDF</Button></div>
    <Card className="printable-invoice">
      <div className="invoice-brand"><div className="invoice-brand-icon"><ReceiptText size={20} /></div><div><strong>Juniper &amp; Grain</strong><span>Restaurant &amp; Kitchen</span></div><div className="invoice-heading"><small>TAX INVOICE</small><strong>{bill.billNumber}</strong></div></div>
      <div className="invoice-meta"><div><small>Order</small><strong>{bill.order?.orderNumber || 'Restaurant order'}</strong></div><div><small>Service</small><strong>{table || (bill.order?.orderType === 'TAKEAWAY' ? 'Takeaway' : 'Dine-in')}</strong></div><div><small>Date &amp; time</small><strong>{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(bill.createdAt))}</strong></div><div><small>Cashier</small><strong>{bill.cashier?.name || 'Cashier'}</strong></div></div>
      <div className="invoice-items-scroll"><table className="invoice-items"><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{bill.items.map((item, index) => <tr key={`${item.name}-${index}`}><td>{item.name}</td><td>{item.quantity}</td><td>{currency(item.price)}</td><td>{currency(item.amount)}</td></tr>)}</tbody></table></div>
      <div className="invoice-total-list"><div><span>Subtotal</span><strong>{currency(bill.subtotal)}</strong></div><div><span>Discount {bill.discountType === 'PERCENT' ? `(${bill.discountValue}%)` : ''}</span><strong>− {currency(bill.discountAmount)}</strong></div><div><span>CGST (2.5%)</span><strong>{currency(bill.cgst)}</strong></div><div><span>SGST (2.5%)</span><strong>{currency(bill.sgst)}</strong></div><div><span>Grand total</span><strong>{currency(bill.grandTotal)}</strong></div><div><span>Round-off</span><strong>{bill.roundOff >= 0 ? '+' : '−'} {currency(Math.abs(bill.roundOff))}</strong></div><div className="invoice-payable"><span>Final payable</span><strong>{currency(bill.finalPayableAmount)}</strong></div></div>
      <div className="invoice-payment-history"><small>Payments</small>{bill.payments.length ? bill.payments.map((payment, index) => <div key={payment._id || index}><span>{payment.mode}{payment.paidAt ? ` · ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(payment.paidAt))}` : ''}</span><strong>{currency(payment.amount)}</strong></div>) : <span>No payments recorded</span>}{bill.paymentStatus === 'PARTIAL' && <div><span>Remaining balance</span><strong>{currency(outstandingCents / 100)}</strong></div>}</div>
      {bill.cancelled && <div className="invoice-cancellation"><strong>Bill cancelled</strong><span>{bill.cancelledAt ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(bill.cancelledAt)) : ''}{bill.cancelledBy?.name ? ` · by ${bill.cancelledBy.name}` : ''}</span><small>Original bill and payment entries retained for audit.</small></div>}
      <div className="invoice-thanks">Thank you for dining with us.</div>
    </Card>
    {!bill.cancelled && bill.paymentStatus !== 'PAID' && <Card className="payment-entry-card"><div className="card-heading"><div><h2>Record payment</h2><p>Outstanding balance: <strong>{currency(outstandingCents / 100)}</strong></p></div><Badge tone="teal">{lines.length} {lines.length === 1 ? 'entry' : 'entries'}</Badge></div><div className="payment-entry-list">{lines.map((line, index) => <div className="payment-entry-row" key={index}><label><span>Mode</span><select aria-label={`Payment mode ${index + 1}`} value={line.mode} onChange={(event) => setLines((current) => current.map((entry, row) => row === index ? { ...entry, mode: event.target.value as PaymentLine['mode'] } : entry))}><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option></select></label><label><span>Amount (₹)</span><input aria-label={`Payment amount ${index + 1}`} type="number" min="0.01" step="0.01" value={line.amount} onChange={(event) => setLines((current) => current.map((entry, row) => row === index ? { ...entry, amount: event.target.value } : entry))} placeholder="0.00" /></label><button className="icon-button row-action row-action-danger" aria-label={`Remove payment ${index + 1}`} disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, row) => row !== index))}><Trash2 size={15} /></button></div>)}</div><div className={`payment-entry-total ${enteredCents === outstandingCents ? 'payment-total-match' : ''}`}><span>Entered total</span><strong>{currency(enteredCents / 100)} <small>of {currency(outstandingCents / 100)}</small></strong></div><div className="payment-entry-actions"><Button className="button-secondary" onClick={() => setLines((current) => [...current, { mode: 'UPI', amount: '' }])} disabled={lines.length >= 10}><Plus size={15} />Add payment mode</Button><Button loading={savingPayment} disabled={enteredCents !== outstandingCents || enteredCents <= 0} onClick={() => void submitPayment()}>Confirm payment</Button></div></Card>}
    {bill.paymentStatus === 'PAID' && <div className="payment-confirmation"><Badge tone="success">{bill.finalPayableAmount === 0 ? 'No balance due' : 'Payment confirmed'}</Badge><span>{bill.finalPayableAmount === 0 ? 'The discount covers the full bill.' : `Paid in full across ${bill.payments.length} payment ${bill.payments.length === 1 ? 'entry' : 'entries'}.`}</span></div>}
  </div>
}
