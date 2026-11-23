import { useCallback, useEffect, useState } from 'react'
import { Ban, Eye, ReceiptText, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { BillPanel } from '../components/BillPanel'
import { Badge, Button, Card, DataTable, ErrorPanel, LoadingPanel, PageHeading, type DataColumn } from '../components/ui'
import api from '../services/api'
import type { BillRecord } from '../types/app'

const currency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount)
const errorMessage = (error: unknown) => (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message || 'Could not load bill history.'

export function BillHistoryPage() {
  const { user } = useAuth()
  const [bills, setBills] = useState<BillRecord[]>([])
  const [selected, setSelected] = useState<BillRecord | null>(null)
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [paymentMode, setPaymentMode] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadBills = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await api.get<{ bills: BillRecord[]; pagination: { pages: number } }>('/bills', { params: { page, limit: 20, ...(search.trim() ? { search: search.trim() } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}), ...(paymentMode ? { paymentMode } : {}) } })
      setBills(data.bills)
      setPages(data.pagination.pages || 1)
    } catch (request) { setError(errorMessage(request)) } finally { setLoading(false) }
  }, [search, from, to, paymentMode, page])
  useEffect(() => { const timer = window.setTimeout(() => void loadBills(), 180); return () => window.clearTimeout(timer) }, [loadBills])

  async function openBill(id: string) {
    try { const { data } = await api.get<{ bill: BillRecord }>(`/bills/${id}`); setSelected(data.bill) }
    catch (request) { setError(errorMessage(request)) }
  }

  async function cancelBill(bill: BillRecord) {
    if (!window.confirm(`Cancel ${bill.billNumber}? The bill and its payment history will be preserved for audit.`)) return
    try {
      await api.post(`/bills/${bill._id}/cancel`)
      toast.success(`${bill.billNumber} cancelled. The audit record was preserved.`)
      await Promise.all([loadBills(), selected?._id === bill._id ? openBill(bill._id) : Promise.resolve()])
    } catch (request) {
      toast.error((request as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message || 'Bill could not be cancelled.')
    }
  }

  const columns: DataColumn<BillRecord>[] = [
    { key: 'number', label: 'Bill', render: (bill) => <strong className="bill-number">{bill.billNumber}</strong> },
    { key: 'order', label: 'Order', render: (bill) => <span>{bill.order?.orderNumber || '—'}<small>{bill.order?.orderType === 'TAKEAWAY' ? 'Takeaway' : bill.order?.orderType === 'DINE_IN' && bill.order.table && typeof bill.order.table === 'object' ? bill.order.table.tableNumber : 'Dine-in'}</small></span> },
    { key: 'date', label: 'Date & time', render: (bill) => <span>{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(bill.createdAt))}</span> },
    { key: 'cashier', label: 'Cashier', render: (bill) => <span>{bill.cashier?.name || '—'}</span> },
    { key: 'payment', label: 'Payment', render: (bill) => <div className="payment-tags">{bill.payments.length ? [...new Set(bill.payments.map((payment) => payment.mode))].map((mode) => <span key={mode}>{mode}</span>) : <span className="muted-cell">—</span>}</div> },
    { key: 'status', label: 'Status', render: (bill) => <Badge tone={bill.cancelled ? 'danger' : bill.paymentStatus === 'PAID' ? 'success' : bill.paymentStatus === 'PARTIAL' ? 'warning' : 'neutral'}>{bill.cancelled ? 'Cancelled' : bill.paymentStatus}</Badge> },
    { key: 'total', label: 'Final payable', className: 'align-right', render: (bill) => <strong>{currency(bill.finalPayableAmount)}</strong> },
    { key: 'action', label: 'Actions', className: 'align-right', render: (bill) => <div className="history-actions"><Button className="button-secondary history-view-button" onClick={() => void openBill(bill._id)}><Eye size={14} />View</Button>{user?.role === 'ADMIN' && !bill.cancelled && <Button className="button-danger history-view-button" title="Cancel bill and preserve audit record" onClick={() => void cancelBill(bill)}><Ban size={14} />Cancel</Button>}</div> },
  ]

  return <div className="bill-history-page"><PageHeading title="Bill history" description="Search invoices, review payment entries, or print a customer copy." />{error && <ErrorPanel message={error} onRetry={() => void loadBills()} />}<Card className="bill-history-card"><div className="bill-history-filters"><label className="search-field"><Search size={16} /><input aria-label="Search bill history" placeholder="Search by bill number" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></label><label className="history-date-filter"><span>From</span><input aria-label="Bills from date" type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setPage(1) }} /></label><label className="history-date-filter"><span>To</span><input aria-label="Bills to date" type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(1) }} /></label><label className="history-mode-filter"><span>Payment mode</span><select aria-label="Filter bills by payment mode" value={paymentMode} onChange={(event) => { setPaymentMode(event.target.value); setPage(1) }}><option value="">All modes</option><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option></select></label></div>{loading ? <LoadingPanel label="Loading bill history" /> : <DataTable rows={bills} columns={columns} ariaLabel="Bill history" empty={<div className="billing-empty"><ReceiptText size={22} /><strong>No bills found</strong><span>{search || from || to || paymentMode ? 'Adjust the filters and try again.' : 'Generated bills will appear here.'}</span></div>} />}<div className="history-pagination"><span>Page {page} of {pages}</span><div><Button className="button-secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button><Button className="button-secondary" disabled={page >= pages || loading} onClick={() => setPage((value) => Math.min(pages, value + 1))}>Next</Button></div></div></Card>{selected && <div className="bill-detail-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><section className="bill-detail-modal" role="dialog" aria-modal="true" aria-label={`Bill ${selected.billNumber}`}><div className="bill-detail-header"><div><strong>Bill details</strong><span>{selected.billNumber}</span></div><button className="icon-button" aria-label="Close bill details" onClick={() => setSelected(null)}>×</button></div><BillPanel bill={selected} onUpdated={() => void openBill(selected._id)} /></section></div>}</div>
}
