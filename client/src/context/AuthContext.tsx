import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import api from '../services/api'
import type { User } from '../types/app'

interface AuthContextValue {
  user: User | null
  ready: boolean
  login: (identity: string, password: string, role: User['role']) => Promise<User>
  register: (input: { name: string; email: string; username: string; password: string; role: User['role'] }) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    api.get<{ user: User | null }>('/auth/session')
      .then(({ data }) => { if (active) setUser(data.user) })
      .catch(() => { if (active) setUser(null) })
      .finally(() => { if (active) setReady(true) })
    return () => { active = false }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    ready,
    async login(identity, password, role) {
      const { data } = await api.post<{ user: User }>('/auth/login', { identity, password, role })
      setUser(data.user)
      return data.user
    },
    async register(input) {
      const { data } = await api.post<{ user: User }>('/auth/register', input)
      setUser(data.user)
      return data.user
    },
    async logout() {
      try { await api.post('/auth/logout') } finally { setUser(null) }
    },
  }), [user, ready])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
