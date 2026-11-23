import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Minus, Plus, Search, ShoppingBag, Trash2, UtensilsCrossed } from 'lucide-react'
import toast from 'react-hot-toast'
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeading } from '../components/ui'
import api from '../services/api'
import type { MenuCategory, MenuItem, OrderRecord, RestaurantTable } from '../types/app'

const categories: MenuCategory[] = ['Starters', 'Main Course', 'Breads', 'Biryani', 'Beverages', 'Desserts']
type CartLine = { menuItemId: string; name: string; price: number; quantity: number; foodType: MenuItem['foodType'] }
type OpenOrder = Pick<OrderRecord, '_id' | 'orderNumber' | 'orderType' | 'table' | 'status' | 'items' | 'createdAt'>
const currency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount)
const errorMessage = (error: unknown) => (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message || 'Could not complete the request. Try again.'

function FoodMark({ type }: { type: MenuItem['foodType'] }) {
  return <span className={`food-indicator ${type === 'VEG' ? 'food-veg' : 'food-nonveg'}`} aria-label={type === 'VEG' ? 'Vegetarian' : 'Non-vegetarian'}><i /></span>
}

export function PosPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const orderId = searchParams.get('orderId')
  const tableParam = searchParams.get('table') || ''
  const orderTypeParam = searchParams.get('orderType')
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([])
  const [cart, setCart] = useState<CartLine[]>([])
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY'>(orderTypeParam === 'TAKEAWAY' ? 'TAKEAWAY' : 'DINE_IN')
  const [tableId, setTableId] = useState(tableParam)
  const [orderNumber, setOrderNumber] = useState('')
  const [orderStatus, setOrderStatus] = useState<OrderRecord['status'] | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<MenuCategory | ''>('')
  const [loading, setLoading] = useState(true)
  const [orderLoading, setOrderLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadReferences = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [menuResponse, tableResponse] = await Promise.all([
        api.get<{ items: MenuItem[] }>('/menu', { params: { page: 1, limit: 100, available: 'true' } }),
        api.get<{ tables: RestaurantTable[] }>('/tables'),
      ])
      setMenuItems(menuResponse.data.items)
      setTables(tableResponse.data.tables)
    } catch (request) { setError(errorMessage(request)) } finally { setLoading(false) }
  }, [])

  const loadOpenOrders = useCallback(async () => {
    try {
      const { data } = await api.get<{ orders: OpenOrder[] }>('/orders', { params: { status: 'OPEN', page: 1, limit: 100 } })
      setOpenOrders(data.orders)
    } catch (request) { setError(errorMessage(request)) }
  }, [])

  useEffect(() => { void loadReferences(); void loadOpenOrders() }, [loadReferences, loadOpenOrders])

  useEffect(() => {
    let active = true
    if (!orderId) {
      setCart([])
      setOrderNumber('')
      setOrderStatus(null)
      setOrderType(orderTypeParam === 'TAKEAWAY' ? 'TAKEAWAY' : 'DINE_IN')
      setTableId(tableParam)
      return () => { active = false }
    }
    setOrderLoading(true)
    api.get<{ order: OrderRecord }>(`/orders/${orderId}`)
      .then(({ data }) => {
        if (!active) return
        const order = data.order
        const currentTable = typeof order.table === 'string' ? order.table : order.table?._id || ''
        setOrderNumber(order.orderNumber)
        setOrderStatus(order.status)
        setOrderType(order.orderType)
        setTableId(currentTable)
        setCart(order.items.map((item) => ({ menuItemId: String(item.menuItem), name: item.name, price: item.price, quantity: item.quantity, foodType: menuItems.find((menuItem) => menuItem._id === String(item.menuItem))?.foodType || 'VEG' })))
      })
      .catch((request) => { if (active) setError(errorMessage(request)) })
      .finally(() => { if (active) setOrderLoading(false) })
    return () => { active = false }
  }, [orderId, tableParam, orderTypeParam, menuItems])

  const displayedItems = useMemo(() => menuItems.filter((item) => (!category || item.category === category) && (!search.trim() || item.name.toLowerCase().includes(search.trim().toLowerCase()))), [menuItems, search, category])
  const subtotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0)
  const selectedTable = tables.find((table) => table._id === tableId)
  const readOnly = orderStatus !== null && orderStatus !== 'OPEN'

  function selectOrder(nextOrderId: string) {
    if (nextOrderId) setSearchParams({ orderId: nextOrderId })
    else setSearchParams({ orderType: 'DINE_IN' })
  }

  function selectOrderType(type: 'DINE_IN' | 'TAKEAWAY') {
    setOrderType(type)
    setTableId('')
    setSearchParams({ orderType: type })
  }

  function selectTable(nextTableId: string) {
    setTableId(nextTableId)
    setSearchParams(nextTableId ? { orderType: 'DINE_IN', table: nextTableId } : { orderType: 'DINE_IN' })
  }

  function addToCart(item: MenuItem) {
    if (readOnly) return
    setCart((current) => {
      const existing = current.find((line) => line.menuItemId === item._id)
      if (existing) return current.map((line) => line.menuItemId === item._id ? { ...line, quantity: Math.min(999, line.quantity + 1) } : line)
      return [...current, { menuItemId: item._id, name: item.name, price: item.price, quantity: 1, foodType: item.foodType }]
    })
  }

  function changeQuantity(menuItemId: string, amount: number) {
    setCart((current) => current.flatMap((line) => {
      if (line.menuItemId !== menuItemId) return [line]
      const quantity = line.quantity + amount
      return quantity > 0 ? [{ ...line, quantity }] : []
    }))
  }

  async function saveOrder() {
    if (!cart.length) { toast.error('Add at least one menu item to the order.'); return }
    if (orderType === 'DINE_IN' && !tableId) { toast.error('Choose a free table for this dine-in order.'); return }
    setSaving(true)
    setError('')
    try {
      const items = cart.map((line) => ({ menuItem: line.menuItemId, quantity: line.quantity }))
      if (orderId) {
        const { data } = await api.patch<{ order: OrderRecord }>(`/orders/${orderId}`, { items })
        setOrderNumber(data.order.orderNumber)
        setOrderStatus(data.order.status)
        toast.success('Order changes saved')
      } else {
        const { data } = await api.post<{ order: OrderRecord }>('/orders', { orderType, table: orderType === 'DINE_IN' ? tableId : null, items })
        setOrderNumber(data.order.orderNumber)
        setOrderStatus(data.order.status)
        setSearchParams({ orderId: data.order._id })
        toast.success(`${data.order.orderNumber} saved`)
      }
      await Promise.all([loadReferences(), loadOpenOrders()])
    } catch (request) {
      const message = errorMessage(request)
      toast.error(message)
      if ((request as { response?: { status?: number } }).response?.status === 409) await loadReferences()
    } finally { setSaving(false) }
  }

  function startNewOrder() {
    setCart([])
    setOrderNumber('')
    setOrderStatus(null)
    setOrderType('DINE_IN')
    setTableId('')
    setSearchParams({ orderType: 'DINE_IN' })
  }

  return <div className="pos-page">
    <PageHeading title="POS / Orders" description="Build an order and keep its item prices saved at the time of service." action={orderId ? <Button className="button-secondary" onClick={startNewOrder}><Plus size={15} />New order</Button> : undefined} />
    {error && <ErrorPanel message={error} onRetry={() => { void loadReferences(); void loadOpenOrders() }} />}
    <section className="pos-layout">
      <div className="pos-menu-column">
        <Card className="pos-order-toolbar">
          <div className="order-type-control" role="group" aria-label="Order type">
            <button type="button" aria-pressed={orderType === 'DINE_IN'} className={orderType === 'DINE_IN' ? 'order-type-active' : ''} onClick={() => selectOrderType('DINE_IN')} disabled={Boolean(orderId)}><UtensilsCrossed size={15} />Dine-in</button>
            <button type="button" aria-pressed={orderType === 'TAKEAWAY'} className={orderType === 'TAKEAWAY' ? 'order-type-active' : ''} onClick={() => selectOrderType('TAKEAWAY')} disabled={Boolean(orderId)}><ShoppingBag size={15} />Takeaway</button>
          </div>
          {orderType === 'DINE_IN' ? <label className="table-select-label"><span>Table</span><select value={tableId} disabled={Boolean(orderId)} onChange={(event) => selectTable(event.target.value)}><option value="">Select a free table</option>{tables.filter((table) => table.status === 'FREE' || table._id === tableId).map((table) => <option value={table._id} key={table._id}>{table.tableNumber} · {table.status === 'RUNNING' ? 'Current order' : 'Free'}</option>)}</select></label> : <div className="takeaway-note"><ShoppingBag size={15} /><span>Takeaway order</span></div>}
          {orderId && <div className="order-identification"><Badge tone={readOnly ? 'warning' : 'teal'}>{orderStatus || 'OPEN'}</Badge><span>{orderNumber}</span>{selectedTable && <small>{selectedTable.tableNumber}</small>}</div>}
        </Card>

        <Card className="open-orders-card"><div className="open-orders-label"><span>Open orders</span><Badge tone="neutral">{openOrders.length}</Badge></div>{openOrders.length ? <div className="open-order-chips">{openOrders.map((order) => {
          const table = typeof order.table === 'object' && order.table ? order.table.tableNumber : ''
          return <button type="button" key={order._id} className={`open-order-chip ${order._id === orderId ? 'open-order-chip-active' : ''}`} onClick={() => selectOrder(order._id)}><strong>{order.orderNumber}</strong><span>{order.orderType === 'DINE_IN' ? table || 'Dine-in' : 'Takeaway'}</span></button>
        })}</div> : <p>No open orders. Choose dine-in or takeaway to begin.</p>}</Card>

        <div className="menu-browser-heading"><div><h2>Menu</h2><span>{displayedItems.length} available items</span></div><label className="pos-search"><Search size={16} /><input aria-label="Search available menu" placeholder="Find a dish" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
        <div className="category-tabs" role="group" aria-label="Filter menu by category"><button type="button" aria-pressed={!category} className={!category ? 'category-tab-active' : ''} onClick={() => setCategory('')}>All items</button>{categories.map((entry) => <button type="button" aria-pressed={category === entry} className={category === entry ? 'category-tab-active' : ''} key={entry} onClick={() => setCategory(category === entry ? '' : entry)}>{entry}</button>)}</div>
        {loading ? <Card><LoadingPanel label="Loading available dishes" /></Card> : displayedItems.length ? <div className="food-grid">{displayedItems.map((item) => <button type="button" className="food-card" key={item._id} onClick={() => addToCart(item)} disabled={readOnly}>
          <div className="food-card-top"><span className="food-card-art"><UtensilsCrossed size={19} /></span><FoodMark type={item.foodType} /></div><div className="food-card-category">{item.category}</div><strong className="food-card-name">{item.name}</strong><div className="food-card-bottom"><span>{currency(item.price)}</span><i><Plus size={15} /></i></div>
        </button>)}</div> : <Card className="menu-empty"><UtensilsCrossed size={20} /><strong>No dishes found</strong><span>Try a different search or category.</span></Card>}
      </div>

      <Card className="order-cart-card">
        <div className="cart-header"><div><span className="cart-kicker">Current order</span><h2>{orderId ? orderNumber || 'Loading order…' : 'New order'}</h2></div>{orderId && <Badge tone={readOnly ? 'warning' : 'success'}>{readOnly ? 'Billed' : 'Editing'}</Badge>}</div>
        {orderLoading ? <LoadingPanel label="Loading order" /> : <>
          <div className="cart-location"><span className="cart-location-icon"><UtensilsCrossed size={15} /></span><div><small>{orderType === 'DINE_IN' ? 'Dine-in table' : 'Order type'}</small><strong>{orderType === 'DINE_IN' ? selectedTable?.tableNumber || (tableId ? 'Selected table' : 'Choose a table') : 'Takeaway'}</strong></div></div>
          <div className="cart-items-head"><span>Order items</span><span>{cart.reduce((sum, line) => sum + line.quantity, 0)} items</span></div>
          {cart.length ? <div className="cart-lines">{cart.map((line) => <div className="cart-line" key={line.menuItemId}>
            <div className="cart-line-top"><FoodMark type={line.foodType} /><div className="cart-line-info"><strong>{line.name}</strong><span>{currency(line.price)} each</span></div><button type="button" className="icon-button cart-remove" aria-label={`Remove ${line.name}`} disabled={readOnly} onClick={() => setCart((current) => current.filter((entry) => entry.menuItemId !== line.menuItemId))}><Trash2 size={15} /></button></div>
            <div className="cart-line-bottom"><div className="quantity-control"><button type="button" aria-label={`Decrease ${line.name} quantity`} disabled={readOnly} onClick={() => changeQuantity(line.menuItemId, -1)}><Minus size={13} /></button><span>{line.quantity}</span><button type="button" aria-label={`Increase ${line.name} quantity`} disabled={readOnly} onClick={() => changeQuantity(line.menuItemId, 1)}><Plus size={13} /></button></div><strong>{currency(line.price * line.quantity)}</strong></div>
          </div>)}</div> : <div className="cart-empty"><div><ShoppingBag size={21} /></div><strong>Your cart is empty</strong><span>Add dishes from the menu to start an order.</span></div>}
          <div className="cart-totals"><div><span>Subtotal</span><strong>{currency(subtotal)}</strong></div><small>Taxes and discounts are applied when the bill is created.</small><div className="cart-total"><span>Order total</span><strong>{currency(subtotal)}</strong></div></div>
          {readOnly ? <div className="cart-readonly-note">This order has already been billed and can no longer be edited.</div> : <Button className="save-order-button" loading={saving || orderLoading} disabled={!cart.length || (orderType === 'DINE_IN' && !tableId)} onClick={() => void saveOrder()}>{orderId ? 'Save order changes' : 'Save order'}<span>{currency(subtotal)}</span></Button>}
        </>}
      </Card>
    </section>
  </div>
}
