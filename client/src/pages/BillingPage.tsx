import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, FilePlus2, ReceiptText, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { BillPanel } from '../components/BillPanel'
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeading, TextInput } from '../components/ui'
import api from '../services/api'
import type { BillRecord, OrderRecord } from '../types/app'

const currency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount)
const errorMessage = (error: unknown) => (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message || 'Could not load billing data.'
type OrderWithCashier = OrderRecord & { cashier?: { name: string } }

export function BillingPage() {
  const [orders, setOrders] = useState<OrderWithCashier[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [bill, setBill] = useState<BillRecord | null>(null)
  const [discountType, setDiscountType] = useState<'PERCENT' | 'AMOUNT'>('AMOUNT')
  const [discountValue, setDiscountValue] = useState('0')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const selected = orders.find((order) => order._id === selectedId)

  const loadOrders = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await api.get<{ orders: OrderWithCashier[] }>('/orders', { params: { status: 'OPEN', page: 1, limit: 100 } })
      setOrders(data.orders)
      setSelectedId((current) => data.orders.some((order) => order._id === current) ? current : data.orders[0]?._id || '')
    } catch (request) { setError(errorMessage(request)) } finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadOrders() }, [loadOrders])

  async function loadBill(id: string) {
    const { data } = await api.get<{ bill: BillRecord }>(`/bills/${id}`)
    setBill(data.bill)
  }

  async function createBill() {
    if (!selected) return
    const amount = Number(discountValue)
    if (!Number.isFinite(amount) || amount < 0 || (discountType === 'PERCENT' && amount > 100)) { toast.error('Enter a valid discount.'); return }
    setGenerating(true)
    try {
      const { data } = await api.post<{ bill: BillRecord }>('/bills', { order: selected._id, discountType, discountValue: amount })
      await loadBill(data.bill._id)
      await loadOrders()
      toast.success(`${data.bill.billNumber} generated successfully.`)
    } catch (request) { toast.error(errorMessage(request)) } finally { setGenerating(false) }
  }

  const filtered = orders.filter((order) => `${order.orderNumber} ${order.orderType === 'DINE_IN' && typeof order.table === 'object' ? order.table.tableNumber : 'Takeaway'} ${order.cashier?.name || ''}`.toLowerCase().includes(search.trim().toLowerCase()))

  return <div className="billing-page">
    <PageHeading title="Billing" description="Turn a saved order into a clear, itemized tax invoice and record payment." />
    {error && <ErrorPanel message={error} onRetry={() => void loadOrders()} />}
    {bill ? <div className="billing-generated-heading"><div><h2>Invoice ready</h2><p>Review the bill, record payment, or print a copy.</p></div><Button className="button-secondary" onClick={() => setBill(null)}>Back to orders</Button></div> : <section className="billing-workspace">
      <Card className="billing-orders-card"><div className="billing-section-heading"><div><h2>Orders ready to bill</h2><p>Only saved open orders are shown.</p></div><Badge tone="teal">{orders.length} open</Badge></div><label className="search-field billing-search"><Search size={16} /><input aria-label="Search orders to bill" placeholder="Search order or table" value={search} onChange={(event) => setSearch(event.target.value)} /></label>{loading ? <LoadingPanel label="Loading open orders" /> : filtered.length ? <div className="billable-order-list">{filtered.map((order) => { const table = order.orderType === 'DINE_IN' && typeof order.table === 'object' ? order.table.tableNumber : 'Takeaway'; const isSelected = selectedId === order._id; const total = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0); return <button className={`billable-order ${isSelected ? 'billable-order-active' : ''}`} key={order._id} onClick={() => setSelectedId(order._id)}><span className="billable-order-icon"><ReceiptText size={17} /></span><span className="billable-order-copy"><strong>{order.orderNumber}</strong><small>{table} · {order.items.reduce((sum, item) => sum + item.quantity, 0)} items</small></span><span className="billable-order-total">{currency(total)}</span><ArrowRight size={15} /></button> })}</div> : <div className="billing-empty"><ReceiptText size={22} /><strong>{search ? 'No matching orders' : 'No orders are ready to bill'}</strong><span>{search ? 'Try another order or table.' : 'New open orders will appear here once saved in POS.'}</span></div>}</Card>
      <Card className="billing-create-card"><div className="billing-section-heading"><div><h2>Generate bill</h2><p>Discount is applied before GST.</p></div><span className="billing-icon"><FilePlus2 size={19} /></span></div>{selected ? <><div className="selected-order-summary"><div><span>Selected order</span><strong>{selected.orderNumber}</strong></div><Badge tone={selected.orderType === 'DINE_IN' ? 'teal' : 'neutral'}>{selected.orderType === 'DINE_IN' && typeof selected.table === 'object' ? selected.table.tableNumber : 'Takeaway'}</Badge></div><div className="selected-order-items">{selected.items.map((item, index) => <div key={`${item.menuItem}-${index}`}><span>{item.name} <small>× {item.quantity}</small></span><strong>{currency(item.price * item.quantity)}</strong></div>)}</div><div className="order-subtotal-preview"><span>Subtotal</span><strong>{currency(selected.items.reduce((sum, item) => sum + item.price * item.quantity, 0))}</strong></div><div className="discount-controls"><label className="form-select-label"><span>Discount type</span><select value={discountType} onChange={(event) => setDiscountType(event.target.value as typeof discountType)}><option value="AMOUNT">Fixed amount (₹)</option><option value="PERCENT">Percentage (%)</option></select></label><TextInput label={discountType === 'PERCENT' ? 'Discount percentage' : 'Discount amount'} type="number" min="0" max={discountType === 'PERCENT' ? 100 : undefined} step="0.01" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} endAdornment={<span className="input-unit">{discountType === 'PERCENT' ? '%' : '₹'}</span>} /></div><div className="tax-note">CGST 2.5% + SGST 2.5% are calculated on the discounted amount. The payable total is rounded to the nearest rupee.</div><Button className="generate-bill-button" loading={generating} onClick={() => void createBill()}><FilePlus2 size={16} />Generate bill</Button></> : <div className="billing-empty billing-empty-create"><ReceiptText size={22} /><strong>Select an open order</strong><span>Choose an order to review its items and apply a discount.</span></div>}</Card>
    </section>}
    {bill && <BillPanel bill={bill} onUpdated={() => void loadBill(bill._id)} />}
  </div>
}
