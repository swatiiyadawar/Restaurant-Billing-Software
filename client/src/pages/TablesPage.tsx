import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, Clock3, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Badge, Card, ErrorPanel, LoadingPanel, PageHeading } from '../components/ui'
import api from '../services/api'
import type { RestaurantTable } from '../types/app'

const tableNumbers = Array.from({ length: 10 }, (_, index) => `T${index + 1}`)

export function TablesPage() {
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const loadTables = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get<{ tables: RestaurantTable[] }>('/tables')
      setTables(data.tables)
    } catch (request) {
      setError((request as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message || 'Could not load the table plan.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadTables() }, [loadTables])

  function openTable(table: RestaurantTable | undefined, tableNumber: string) {
    if (!table) {
      toast.error(`${tableNumber} is not initialized. Run the seed script to create restaurant tables.`)
      return
    }
    if (table.status === 'RUNNING') {
      if (!table.currentOrder) {
        toast.error('This table is marked running but has no active order. Refresh the table list or ask an admin to review it.')
        return
      }
      navigate(`/pos?orderId=${table.currentOrder._id}`)
      return
    }
    navigate(`/pos?orderType=DINE_IN&table=${table._id}`)
  }

  const freeCount = tables.filter((table) => table.status === 'FREE').length
  const runningCount = tables.filter((table) => table.status === 'RUNNING').length
  const byNumber = new Map<string, RestaurantTable>(tables.map((table) => [table.tableNumber, table]))

  return <div className="tables-page">
    <PageHeading title="Tables" description="Choose a table to start a dine-in order or return to an active one." action={<div className="table-summary-counts"><span className="table-count-free"><i />{freeCount} free</span><span className="table-count-running"><i />{runningCount} running</span></div>} />
    {error && <ErrorPanel message={error} onRetry={() => void loadTables()} />}
    <Card className="tables-key"><div><Badge tone="success">Free</Badge><span>Ready for a new order</span></div><div><Badge tone="warning">Running</Badge><span>Open order in progress</span></div><p><Users size={15} />10 tables in your restaurant</p></Card>
    {loading ? <Card><LoadingPanel label="Loading tables" /></Card> : <section className="table-grid" aria-label="Restaurant tables">
      {tableNumbers.map((number) => {
        const table = byNumber.get(number)
        const running = table?.status === 'RUNNING'
        return <button type="button" className={`table-tile ${running ? 'table-tile-running' : ''} ${!table ? 'table-tile-missing' : ''}`} key={number} onClick={() => openTable(table, number)} aria-label={`${number}, ${table?.status?.toLowerCase() || 'not initialized'}${table?.currentOrder ? `, order ${table.currentOrder.orderNumber}` : ''}`}>
          <div className="table-tile-top"><span className={`table-status-icon ${running ? 'table-status-icon-running' : ''}`}><i /></span><Badge tone={running ? 'warning' : table ? 'success' : 'neutral'}>{table?.status || 'Not set up'}</Badge></div>
          <strong className="table-tile-number">{number}</strong>
          {running && table?.currentOrder ? <div className="table-order-meta"><span>{table.currentOrder.orderNumber}</span><small>{table.currentOrder.itemCount} {table.currentOrder.itemCount === 1 ? 'item' : 'items'}</small></div> : <div className="table-order-meta table-order-free"><Clock3 size={13} /><span>{table ? 'Ready for guests' : 'Seed tables to begin'}</span></div>}
          <span className="table-tile-action">{running ? 'Open order' : 'Start order'}<ArrowUpRight size={14} /></span>
        </button>
      })}
    </section>}
  </div>
}
