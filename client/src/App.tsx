import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { MenuPage } from './pages/MenuPage'
import { PosPage } from './pages/PosPage'
import { TablesPage } from './pages/TablesPage'
import { BillingPage } from './pages/BillingPage'
import { BillHistoryPage } from './pages/BillHistoryPage'
import type { Role } from './types/app'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })))

function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={user?.role === 'ADMIN' ? '/dashboard' : '/pos'} replace />
}

const adminRoles: Role[] = ['ADMIN']
const cashierRoles: Role[] = ['ADMIN', 'CASHIER']

export default function App() {
  return <AuthProvider><BrowserRouter><Suspense fallback={<div className="auth-loading"><span className="loading-copy">Opening workspace…</span></div>}><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}><Route element={<AppLayout />}>
      <Route index element={<HomeRedirect />} />
      <Route element={<ProtectedRoute allow={adminRoles} />}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="tables" element={<TablesPage />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>
      <Route element={<ProtectedRoute allow={cashierRoles} />}>
        <Route path="pos" element={<PosPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="bills" element={<BillHistoryPage />} />
      </Route>
    </Route></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense><Toaster position="top-right" toastOptions={{ duration: 3200 }} /></BrowserRouter></AuthProvider>
}
