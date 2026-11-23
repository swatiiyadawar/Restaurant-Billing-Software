import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LoadingPanel } from './ui'
import type { Role } from '../types/app'

export function ProtectedRoute({ allow }: { allow?: Role[] }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <main className="auth-loading"><LoadingPanel label="Checking your session" /></main>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (allow && !allow.includes(user.role)) return <Navigate to={user.role === 'ADMIN' ? '/dashboard' : '/pos'} replace />
  return <Outlet />
}
