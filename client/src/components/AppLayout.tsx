import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, ChefHat, ClipboardList, CreditCard, LayoutDashboard, LogOut, Menu as MenuIcon, ReceiptText, Table2, Utensils, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const links = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN'] },
  { label: 'POS / Orders', to: '/pos', icon: ClipboardList, roles: ['ADMIN', 'CASHIER'] },
  { label: 'Tables', to: '/tables', icon: Table2, roles: ['ADMIN'] },
  { label: 'Menu management', to: '/menu', icon: Utensils, roles: ['ADMIN'] },
  { label: 'Billing', to: '/billing', icon: CreditCard, roles: ['ADMIN', 'CASHIER'] },
  { label: 'Bill history', to: '/bills', icon: ReceiptText, roles: ['ADMIN', 'CASHIER'] },
  { label: 'Reports', to: '/reports', icon: BarChart3, roles: ['ADMIN'] },
]

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const currentDate = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
  const title = links.find((link) => location.pathname === link.to)?.label || 'Overview'

  async function handleLogout() {
    try {
      await logout()
      toast.success('You have signed out')
    } catch {
      toast.error('The server could not confirm sign out. Check your connection.')
    } finally {
      navigate('/login', { replace: true })
    }
  }

  const sidebar = <aside className="sidebar">
    <div className="brand-lockup">
      <div className="brand-mark"><ChefHat aria-hidden="true" size={21} /></div>
      <div><strong>DineFlow</strong><span>Restaurant operations</span></div>
      <button className="icon-button sidebar-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={19} /></button>
    </div>
    <div className="sidebar-label">Workspace</div>
    <nav className="side-nav" aria-label="Main navigation">
      {links.filter((link) => link.roles.includes(user?.role || '')).map(({ icon: Icon, ...link }) => <NavLink key={link.to} to={link.to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
        <Icon size={19} strokeWidth={1.8} aria-hidden="true" /><span>{link.label}</span>
        {link.to === '/pos' && <span className="nav-live-dot" aria-label="Open orders" />}
      </NavLink>)}
    </nav>
    <div className="sidebar-bottom">
      <div className="restaurant-card"><div className="restaurant-symbol"><Utensils size={16} /></div><div><span>Restaurant</span><strong>Juniper &amp; Grain</strong></div></div>
      <button className="nav-link signout-link" onClick={handleLogout}><LogOut size={18} aria-hidden="true" /><span>Sign out</span></button>
    </div>
  </aside>

  return <div className="app-shell">
    {mobileOpen && <button aria-label="Close navigation overlay" className="mobile-scrim" onClick={() => setMobileOpen(false)} />}
    <div className={`sidebar-holder ${mobileOpen ? 'sidebar-holder-open' : ''}`}>{sidebar}</div>
    <div className="app-column">
      <header className="topbar">
        <button className="icon-button mobile-menu-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><MenuIcon size={21} /></button>
        <div className="topbar-title"><span>Juniper &amp; Grain</span><strong>{title}</strong></div>
        <div className="topbar-right">
          <span className="topbar-date">{currentDate}</span>
          <div className="profile-chip"><div className="avatar">{user?.name?.slice(0, 1).toUpperCase() || 'D'}</div><div className="profile-copy"><strong>{user?.name}</strong><span>{user?.role === 'ADMIN' ? 'Administrator' : 'Cashier'}</span></div></div>
        </div>
      </header>
      <main id="main-content" className="main-content" tabIndex={-1}><Outlet /></main>
    </div>
  </div>
}
