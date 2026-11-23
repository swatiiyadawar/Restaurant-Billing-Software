import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Circle, Pencil, Plus, Search, Trash2, Utensils } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Card, DataTable, ErrorPanel, LoadingPanel, Modal, PageHeading, TextInput, type DataColumn } from '../components/ui'
import api from '../services/api'
import type { MenuCategory, MenuItem } from '../types/app'

const categories: MenuCategory[] = ['Starters', 'Main Course', 'Breads', 'Biryani', 'Beverages', 'Desserts']
type MenuDraft = Omit<MenuItem, '_id'>
const blankDraft: MenuDraft = { name: '', category: 'Starters', price: 0, foodType: 'VEG', available: true }
const requestError = (error: unknown) => (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message || 'The request could not be completed. Try again.'
const currency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount)

export function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [draft, setDraft] = useState<MenuDraft>(blankDraft)
  const [deleting, setDeleting] = useState<MenuItem | null>(null)
  const [saving, setSaving] = useState(false)

  const loadMenu = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get<{ items: MenuItem[] }>('/menu', { params: { page: 1, limit: 100, ...(search.trim() ? { search: search.trim() } : {}), ...(category ? { category } : {}) } })
      setItems(data.items)
    } catch (request) { setError(requestError(request)) } finally { setLoading(false) }
  }, [search, category])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadMenu() }, search ? 220 : 0)
    return () => window.clearTimeout(timer)
  }, [loadMenu, search])

  const closeEditor = useCallback(() => { setEditing(null); setDraft(blankDraft) }, [])

  function startCreate() { setDraft(blankDraft); setEditing({ _id: '' } as MenuItem) }
  function startEdit(item: MenuItem) {
    setDraft({ name: item.name, category: item.category, price: item.price, foodType: item.foodType, available: item.available })
    setEditing(item)
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = { ...draft, price: Number(draft.price) }
      if (editing?._id) await api.patch(`/menu/${editing._id}`, payload)
      else await api.post('/menu', payload)
      toast.success(editing?._id ? 'Menu item updated' : 'Menu item added')
      closeEditor()
      await loadMenu()
    } catch (request) { toast.error(requestError(request)) } finally { setSaving(false) }
  }

  async function toggleAvailability(item: MenuItem) {
    try {
      await api.patch(`/menu/${item._id}`, { available: !item.available })
      toast.success(`${item.name} marked ${item.available ? 'unavailable' : 'available'}`)
      await loadMenu()
    } catch (request) { toast.error(requestError(request)) }
  }

  async function deleteItem() {
    if (!deleting) return
    try {
      await api.delete(`/menu/${deleting._id}`)
      toast.success('Menu item deleted')
      setDeleting(null)
      await loadMenu()
    } catch (request) { toast.error(requestError(request)) }
  }

  const columns: DataColumn<MenuItem>[] = [
    { key: 'name', label: 'Food item', render: (item) => <div className="menu-item-name"><span className={`food-indicator ${item.foodType === 'VEG' ? 'food-veg' : 'food-nonveg'}`} aria-label={item.foodType === 'VEG' ? 'Vegetarian' : 'Non-vegetarian'}><i /></span><strong>{item.name}</strong></div> },
    { key: 'category', label: 'Category', render: (item) => <span className="table-secondary">{item.category}</span> },
    { key: 'price', label: 'Price', render: (item) => <strong className="table-price">{currency(item.price)}</strong> },
    { key: 'available', label: 'Availability', render: (item) => <button type="button" className={`availability-switch ${item.available ? 'availability-on' : ''}`} role="switch" aria-checked={item.available} onClick={() => void toggleAvailability(item)}><span className="switch-track"><i /></span><span>{item.available ? 'Available' : 'Unavailable'}</span></button> },
    { key: 'actions', label: 'Actions', className: 'align-right', render: (item) => <div className="row-actions"><button type="button" className="icon-button row-action" aria-label={`Edit ${item.name}`} onClick={() => startEdit(item)}><Pencil size={15} /></button><button type="button" className="icon-button row-action row-action-danger" aria-label={`Delete ${item.name}`} onClick={() => setDeleting(item)}><Trash2 size={15} /></button></div> },
  ]

  return <div className="menu-page">
    <PageHeading title="Menu management" description="Keep your dishes, prices, and availability up to date." action={<Button onClick={startCreate}><Plus size={16} />Add menu item</Button>} />
    <Card className="menu-toolbar"><label className="search-field"><Search size={17} aria-hidden="true" /><input aria-label="Search menu items" type="search" placeholder="Search food items" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label className="filter-field"><span>Category</span><select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label>
      <div className="menu-count"><Utensils size={15} /><span>{loading ? 'Loading items' : `${items.length} ${items.length === 1 ? 'item' : 'items'}`}</span></div>
    </Card>
    {error && <ErrorPanel message={error} onRetry={() => void loadMenu()} />}
    <Card className="menu-list-card">
      {loading ? <LoadingPanel label="Loading menu items" /> : <DataTable ariaLabel="Menu items" rows={items} columns={columns} empty={<><Circle size={20} /><span>No menu items match this search.</span></>} />}
    </Card>

    {editing && <Modal title={editing._id ? 'Edit menu item' : 'Add menu item'} onClose={closeEditor}>
      <form className="entity-form" onSubmit={saveItem}>
        <TextInput label="Food name" autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Paneer tikka" maxLength={100} required />
        <div className="form-two-columns"><label className="form-select-label">Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as MenuCategory })}>{categories.map((entry) => <option key={entry}>{entry}</option>)}</select></label><TextInput label="Price (₹)" type="number" min="0.01" step="0.01" value={draft.price || ''} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} required /></div>
        <fieldset className="food-type-fieldset"><legend>Food type</legend><div className="food-type-options">{(['VEG', 'NON_VEG'] as const).map((type) => <label key={type} className={`food-type-option ${draft.foodType === type ? 'food-type-selected' : ''}`}><input type="radio" name="foodType" value={type} checked={draft.foodType === type} onChange={() => setDraft({ ...draft, foodType: type })} /><span className={`food-indicator ${type === 'VEG' ? 'food-veg' : 'food-nonveg'}`}><i /></span>{type === 'VEG' ? 'Vegetarian' : 'Non-vegetarian'}</label>)}</div></fieldset>
        <label className="form-availability"><span><strong>Available to order</strong><small>Guests can order this item while it is available.</small></span><input type="checkbox" checked={draft.available} onChange={(event) => setDraft({ ...draft, available: event.target.checked })} /></label>
        <div className="form-actions"><Button type="button" className="button-secondary" onClick={closeEditor}>Cancel</Button><Button type="submit" loading={saving}>{editing._id ? 'Save changes' : 'Add item'}</Button></div>
      </form>
    </Modal>}

    {deleting && <Modal title="Delete menu item?" onClose={() => setDeleting(null)}><div className="confirm-copy"><p><strong>{deleting.name}</strong> will be removed from the menu. Existing orders keep their saved item details.</p><div className="form-actions"><Button className="button-secondary" onClick={() => setDeleting(null)}>Keep item</Button><Button className="button-danger" onClick={() => void deleteItem()}>Delete item</Button></div></div></Modal>}
  </div>
}
