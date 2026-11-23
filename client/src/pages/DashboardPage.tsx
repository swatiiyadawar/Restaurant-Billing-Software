import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, Banknote, ChartNoAxesColumnIncreasing, CircleDollarSign, CreditCard, ReceiptText, ShoppingBag, Smartphone } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Badge, Card, DataTable, ErrorPanel, LoadingPanel, PageHeading, type DataColumn } from '../components/ui'
import type { Bill, DashboardSummary } from '../types/app'

const currency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
const paymentMeta = {
  CASH: { label: 'Cash', icon: Banknote },
  UPI: { label: 'UPI', icon: Smartphone },
  CARD: { label: 'Card', icon: CreditCard },
}

const transactionColumns: DataColumn<Bill>[] = [
  { key: 'billNumber', label: 'Bill number', render: (bill) => <strong className="bill-number">{bill.billNumber}</strong> },
  { key: 'order', label: 'Order', render: (bill) => <><span className="transaction-order">{bill.order?.orderNumber || '—'}</span><small>{bill.order?.orderType === 'DINE_IN' ? 'Dine-in' : bill.order?.orderType === 'TAKEAWAY' ? 'Takeaway' : '—'}</small></> },
  { key: 'createdAt', label: 'Time', render: (bill) => new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(bill.createdAt)) },
  { key: 'payments', label: 'Payment', render: (bill) => <div className="payment-tags">{bill.payments.length ? [...new Set(bill.payments.map((payment) => payment.mode))].map((mode) => <span key={mode}>{mode}</span>) : <span className="muted-cell">Unpaid</span>}</div> },
  { key: 'paymentStatus', label: 'Status', render: (bill) => <Badge tone={bill.cancelled ? 'danger' : bill.paymentStatus === 'PAID' ? 'success' : bill.paymentStatus === 'PARTIAL' ? 'warning' : 'neutral'}>{bill.cancelled ? 'Cancelled' : bill.paymentStatus === 'PAID' ? 'Paid' : bill.paymentStatus === 'PARTIAL' ? 'Partial' : 'Unpaid'}</Badge> },
  { key: 'amount', label: 'Amount', className: 'align-right', render: (bill) => <strong>{currency(bill.finalPayableAmount)}</strong> },
]

function StatCard({ label, value, footnote, icon: Icon, tone, trend }: { label: string; value: string; footnote: string; icon: typeof CircleDollarSign; tone: string; trend?: string }) {
  return <Card className="stat-card">
    <div className="stat-card-top"><span>{label}</span><div className={`stat-icon ${tone}`}><Icon size={19} strokeWidth={1.8} /></div></div>
    <div className="stat-value">{value}</div>
    <div className="stat-footnote">{trend && <span className="stat-trend"><ArrowUpRight size={13} />{trend}</span>}{footnote}</div>
  </Card>
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  const day = label ? new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${label}T12:00:00Z`)) : ''
  return <div className="chart-tooltip"><span>{day}</span><strong>{currency(payload[0].value)}</strong></div>
}

export function DashboardPage() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [summaryResponse, billsResponse] = await Promise.all([
        api.get<DashboardSummary>('/dashboard'),
        api.get<{ bills: Bill[] }>('/bills', { params: { limit: 5, cancelled: 'false' } }),
      ])
      setSummary(summaryResponse.data)
      setBills(billsResponse.data.bills)
    } catch (requestError) {
      const status = (requestError as { response?: { status?: number } }).response?.status
      setError(status === 401 ? 'Your session has expired. Sign in again to view today’s service.' : 'Dashboard data could not be loaded. Check the API and database connection, then try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadDashboard() }, [loadDashboard])

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const today = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  const todayLabel = summary?.date ? new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${summary.date}T12:00:00Z`)) : today

  return <div className="dashboard-page">
    <PageHeading title={`${greeting}, ${user?.name?.split(' ')[0] || 'there'}`} description="Here’s what’s happening across your restaurant today." action={<div className="date-pill"><span className="date-pill-dot" />{todayLabel}</div>} />
    {error && <ErrorPanel message={error} onRetry={() => void loadDashboard()} />}
    {loading ? <div className="dashboard-loading"><LoadingPanel label="Loading today’s service" /></div> : !summary ? <div className="dashboard-loading" /> : <>
      <section className="stats-grid" aria-label="Today's business summary">
        <StatCard label="Today’s sales" value={currency(summary.totalSales)} footnote="Total billed today" icon={CircleDollarSign} tone="stat-icon-green" />
        <StatCard label="Total bills" value={summary.totalBills.toLocaleString('en-IN')} footnote="Bills created today" icon={ReceiptText} tone="stat-icon-blue" />
        <StatCard label="Total orders" value={summary.totalOrders.toLocaleString('en-IN')} footnote="Orders placed today" icon={ShoppingBag} tone="stat-icon-amber" />
      </section>

      <section className="payment-summary" aria-label="Today's payment summary">
        <div className="payment-summary-heading"><div><span className="section-kicker">Collected by</span><h2>Payment summary</h2></div><span className="payment-summary-date">Today</span></div>
        <div className="payment-methods">{(Object.keys(paymentMeta) as Array<keyof typeof paymentMeta>).map((mode) => {
          const { label, icon: Icon } = paymentMeta[mode]
          return <div className="payment-method" key={mode}><div className={`payment-method-icon payment-${mode.toLowerCase()}`}><Icon size={17} /></div><div className="payment-method-copy"><span>{label}</span><strong>{currency(summary.payments[mode])}</strong></div></div>
        })}</div>
      </section>

      <section className="insights-grid">
        <Card className="sales-card">
          <div className="card-heading"><div><h2>Sales overview</h2><p>Daily sales for the last seven days</p></div></div>
          {summary.salesTrend.length ? <div className="sales-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={summary.salesTrend} margin={{ top: 12, right: 8, left: -13, bottom: 0 }}>
            <defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#158277" stopOpacity={0.19} /><stop offset="98%" stopColor="#158277" stopOpacity={0.01} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="#E9EEEF" strokeDasharray="3 5" />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={12} tick={{ fill: '#849297', fontSize: 11 }} tickFormatter={(value: string) => new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#849297', fontSize: 11 }} tickFormatter={(value: number) => value >= 1000 ? `₹${Math.round(value / 1000)}k` : `₹${value}`} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#AABDB9', strokeDasharray: '4 4' }} />
            <Area type="monotone" dataKey="sales" stroke="#158277" strokeWidth={2.5} fill="url(#salesFill)" isAnimationActive={false} activeDot={{ r: 5, fill: '#fff', stroke: '#158277', strokeWidth: 2 }} />
          </AreaChart></ResponsiveContainer></div> : <div className="empty-chart"><ChartNoAxesColumnIncreasing size={22} /><span>Sales activity will appear here.</span></div>}
          <div className="chart-caption"><span><i />Sales</span><small>All amounts in INR</small></div>
        </Card>

        <Card className="top-items-card">
          <div className="card-heading"><div><h2>Top-selling items</h2><p>By quantity sold today</p></div><span className="today-mark">Today</span></div>
          {summary.topSellingItems.length ? <div className="top-item-list">{summary.topSellingItems.map((item, index) => <div className="top-item-row" key={item.name}>
            <span className={`item-rank ${index === 0 ? 'item-rank-first' : ''}`}>{String(index + 1).padStart(2, '0')}</span>
            <div className="top-item-copy"><strong>{item.name}</strong><span>{item.quantity} sold</span></div>
            <span className="top-item-sales">{currency(item.sales)}</span>
          </div>)}</div> : <div className="empty-list"><span>No items sold yet today.</span><small>Completed bills will show up here.</small></div>}
        </Card>
      </section>

      <Card className="transactions-card">
        <div className="card-heading transactions-heading"><div><h2>Recent transactions</h2><p>Your latest bills across the restaurant</p></div><Link className="text-link" to="/bills">View bill history <ArrowUpRight size={14} /></Link></div>
        <DataTable ariaLabel="Recent bills" rows={bills} columns={transactionColumns} empty={<><ReceiptText size={20} /><span>No bills have been created today.</span></>} />
      </Card>
      <div className="dashboard-footer"><span><i />Live data from DineFlow</span><span>Updated just now</span></div>
    </>}
  </div>
}
