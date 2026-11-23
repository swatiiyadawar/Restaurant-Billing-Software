import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarDays, Download, Printer, TrendingUp } from 'lucide-react'
import { Button, Card, ErrorPanel, LoadingPanel, PageHeading } from '../components/ui'
import api from '../services/api'

type PaymentMode = 'CASH' | 'UPI' | 'CARD'
interface ReportData {
  from: string
  to: string
  summary: { sales: number; bills: number; orders: number; discounts: number; cancelledBills: number; subtotal: number; cgst: number; sgst: number }
  paymentModes: Array<{ mode: PaymentMode; amount: number; count: number }>
  paymentBreakdown: Record<PaymentMode, number>
  items: Array<{ name: string; quantity: number; amount: number }>
  dayEnd: { totalSales: number; bills: number; paymentBreakdown: Record<PaymentMode, number>; bestSellingItems: ReportData['items'] }
}

const modes: PaymentMode[] = ['CASH', 'UPI', 'CARD']
const colors: Record<PaymentMode, string> = { CASH: '#3b9274', UPI: '#6182b5', CARD: '#c39a55' }
const currency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
const dateToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const errorMessage = (error: unknown) => (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message || 'Could not load report data.'
const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`

export function ReportsPage() {
  const [from, setFrom] = useState(dateToday)
  const [to, setTo] = useState(dateToday)
  const [applied, setApplied] = useState({ from: dateToday(), to: dateToday() })
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadReport = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await api.get<ReportData>('/reports/daily', { params: applied })
      setReport(data)
    } catch (request) { setError(errorMessage(request)) } finally { setLoading(false) }
  }, [applied])
  useEffect(() => { void loadReport() }, [loadReport])
  const itemChart = useMemo(() => report?.items.slice(0, 8).map((item) => ({ ...item, shortName: item.name.length > 22 ? `${item.name.slice(0, 20)}…` : item.name })) || [], [report])

  function applyDates(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!from || !to) return
    if (from > to) { setError('End date must be on or after start date.'); return }
    setApplied({ from, to })
  }

  function downloadCsv() {
    if (!report) return
    const rows = [
      ['DineFlow POS - Sales report', `${report.from} to ${report.to}`],
      ['Total sales', report.summary.sales], ['Total bills', report.summary.bills], ['Total orders', report.summary.orders], ['Total discounts', report.summary.discounts], ['Cancelled bills', report.summary.cancelledBills],
      [], ['Payment mode', 'Amount', 'Payment entries'], ...report.paymentModes.map((row) => [row.mode, row.amount, row.count]),
      [], ['Item name', 'Quantity sold', 'Item revenue'], ...report.items.map((item) => [item.name, item.quantity, item.amount]),
    ]
    const content = rows.map((row) => row.map((cell) => csvCell(cell ?? '')).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `dineflow-sales-${report.from}-to-${report.to}.csv`; link.click(); URL.revokeObjectURL(url)
  }

  return <div className="reports-page"><div className="report-actions"><PageHeading title="Reports" description="Review sales, payments, discounts, and item performance from saved bills." /><div className="report-export-actions"><Button className="button-secondary" disabled={!report} onClick={downloadCsv}><Download size={15} />Download CSV</Button><Button className="button-secondary" disabled={!report} onClick={() => window.print()}><Printer size={15} />Print report</Button></div></div>
    <Card className="report-filter-card"><form className="report-date-form" onSubmit={applyDates}><div className="report-date-title"><span className="report-filter-icon"><CalendarDays size={16} /></span><div><strong>Report period</strong><small>Dates use India Standard Time.</small></div></div><label><span>From</span><input type="date" aria-label="Report from date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} required /></label><label><span>To</span><input type="date" aria-label="Report to date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} required /></label><Button type="submit" loading={loading}>Apply dates</Button></form></Card>
    {error && <ErrorPanel message={error} onRetry={() => void loadReport()} />}
    {loading ? <Card><LoadingPanel label="Loading report from bills" /></Card> : report && <div className="printable-report"><div className="report-print-heading"><div><span>DINEFLOW POS · JUNIPER &amp; GRAIN</span><h2>Sales and day-end report</h2></div><strong>{report.from === report.to ? report.from : `${report.from} — ${report.to}`}</strong></div>
      <section className="report-stat-grid"><ReportStat label="Total sales" value={currency(report.summary.sales)} caption="Non-cancelled bills" icon="₹" /><ReportStat label="Total bills" value={String(report.summary.bills)} caption="Generated in period" icon="B" /><ReportStat label="Total orders" value={String(report.summary.orders)} caption="Orders created in period" icon="O" /><ReportStat label="Total discounts" value={currency(report.summary.discounts)} caption="Applied before GST" icon="−" /><ReportStat label="Cancelled bills" value={String(report.summary.cancelledBills)} caption="Excluded from sales totals" icon="×" /></section>
      <section className="report-chart-grid"><Card className="report-chart-card"><div className="card-heading"><div><h2>Payment mode report</h2><p>Recorded payments from non-cancelled bills</p></div></div>{report.paymentModes.some((row) => row.amount > 0) ? <div className="report-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={report.paymentModes} margin={{ top: 10, right: 12, bottom: 0, left: 4 }}><CartesianGrid vertical={false} stroke="#e9eeee" strokeDasharray="3 5" /><XAxis dataKey="mode" axisLine={false} tickLine={false} tick={{ fill: '#75888c', fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#859497', fontSize: 9 }} tickFormatter={(value: number) => `₹${value}`} /><Tooltip formatter={(value) => currency(Number(value))} /><Bar dataKey="amount" name="Payments" radius={[6, 6, 0, 0]}>{report.paymentModes.map((entry) => <Cell key={entry.mode} fill={colors[entry.mode]} />)}</Bar></BarChart></ResponsiveContainer></div> : <ReportEmpty message="No payments recorded in this period." />}<div className="report-mode-totals">{modes.map((mode) => <div key={mode}><i style={{ backgroundColor: colors[mode] }} /><span>{mode}</span><strong>{currency(report.paymentBreakdown[mode] || 0)}</strong></div>)}</div></Card>
        <Card className="report-chart-card"><div className="card-heading"><div><h2>Item-wise sales</h2><p>Sorted by quantity sold · item revenue before discounts</p></div><TrendingUp size={17} className="report-trend-icon" /></div>{itemChart.length ? <div className="report-chart report-item-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={itemChart} layout="vertical" margin={{ top: 4, right: 13, bottom: 0, left: 2 }}><CartesianGrid horizontal={false} stroke="#e9eeee" strokeDasharray="3 5" /><XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#859497', fontSize: 9 }} /><YAxis type="category" dataKey="shortName" width={112} axisLine={false} tickLine={false} tick={{ fill: '#63787c', fontSize: 9 }} /><Tooltip formatter={(value, name) => [name === 'amount' ? currency(Number(value)) : value, name === 'amount' ? 'Revenue' : 'Quantity']} /><Bar dataKey="quantity" name="Quantity" fill="#258477" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div> : <ReportEmpty message="No item sales in this period." />}</Card></section>
      <Card className="day-end-card"><div className="day-end-heading"><div><span>DAY-END SUMMARY</span><h2>Service closeout</h2></div><strong>{currency(report.dayEnd.totalSales)}</strong></div><div className="day-end-grid"><div><small>Non-cancelled bills</small><strong>{report.dayEnd.bills}</strong></div>{modes.map((mode) => <div key={mode}><small>{mode}</small><strong>{currency(report.dayEnd.paymentBreakdown[mode] || 0)}</strong></div>)}<div className="day-end-best"><small>Best-selling item</small><strong>{report.dayEnd.bestSellingItems[0] ? `${report.dayEnd.bestSellingItems[0].name} · ${report.dayEnd.bestSellingItems[0].quantity} sold` : 'No sales yet'}</strong></div></div></Card>
      <Card className="report-items-card"><div className="card-heading"><div><h2>Item performance</h2><p>Detailed item quantities and gross line revenue</p></div></div>{report.items.length ? <div className="report-item-table-wrap"><table className="report-item-table"><thead><tr><th>Item name</th><th>Quantity sold</th><th className="align-right">Item revenue</th></tr></thead><tbody>{report.items.map((item) => <tr key={item.name}><td>{item.name}</td><td>{item.quantity}</td><td className="align-right">{currency(item.amount)}</td></tr>)}</tbody></table></div> : <ReportEmpty message="No item sales for these dates." />}</Card>
      <div className="report-footer">Sales, bills, and item totals exclude cancelled bills. Payments reflect amounts recorded against retained bills.</div>
    </div>}
  </div>
}

function ReportStat({ label, value, caption, icon }: { label: string; value: string; caption: string; icon: string }) {
  return <Card className="report-stat"><div className="report-stat-top"><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><small>{caption}</small></Card>
}
function ReportEmpty({ message }: { message: string }) { return <div className="report-empty"><TrendingUp size={20} /><span>{message}</span></div> }
