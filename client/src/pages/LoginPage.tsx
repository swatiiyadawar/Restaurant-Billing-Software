import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ChefHat, Eye, EyeOff, LockKeyhole, MoveRight, Sparkles, Utensils, UserRoundPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button, LoadingPanel, TextInput } from '../components/ui'
import type { ApiError, Role } from '../types/app'
import toast from 'react-hot-toast'

export function LoginPage() {
  const { user, ready, login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [role, setRole] = useState<Role>('ADMIN')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!ready) return <main className="auth-loading"><LoadingPanel label="Checking your session" /></main>
  if (user) return <Navigate to={user.role === 'ADMIN' ? '/dashboard' : '/pos'} replace />

  async function finishAuthentication(authenticatedRole: Role, firstName: string) {
    toast.success(mode === 'signin' ? `Welcome back, ${firstName}` : `Account created for ${firstName}`)
    const redirectTo = (location.state as { from?: string } | null)?.from
    navigate(redirectTo || (authenticatedRole === 'ADMIN' ? '/dashboard' : '/pos'), { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const authenticatedUser = mode === 'signin'
        ? await login(identity.trim(), password, role)
        : await register({ name: name.trim(), email: email.trim(), username: username.trim(), password, role })
      await finishAuthentication(authenticatedUser.role, authenticatedUser.name.split(' ')[0])
    } catch (requestError) {
      const apiError = (requestError as { response?: { data?: ApiError } }).response?.data?.error
      const details = apiError?.details?.map(({ field, message: detail }) => `${field.replace(/^body\./, '').replace(/^./, (letter) => letter.toUpperCase())}: ${detail}`).join(' ')
      const message = details || apiError?.message || (mode === 'signin' ? 'Unable to sign in. Check your connection and try again.' : 'Unable to create your account. Check your connection and try again.')
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  function switchMode(nextMode: 'signin' | 'signup') {
    setMode(nextMode)
    if (nextMode === 'signup') setRole('CASHIER')
    setError('')
    setPassword('')
  }

  return <main className="login-page">
    <section className="login-brand-panel">
      <div className="login-brand">
        <div className="login-brand-icon"><ChefHat size={23} /></div>
        <span>DineFlow <b>POS</b></span>
      </div>
      <div className="brand-story">
        <div className="story-kicker"><span />Service, in sync</div>
        <h1>Make every<br />shift flow.</h1>
        <p>One calm place to take orders, keep tables moving, and close the day with confidence.</p>
        <div className="service-illustration" aria-hidden="true">
          <div className="illustration-orbit orbit-one" /><div className="illustration-orbit orbit-two" />
          <div className="plate plate-back" /><div className="plate plate-front"><div className="plate-food"><span /><span /><span /><i /></div></div>
          <div className="flow-tag flow-tag-top"><Sparkles size={14} /><span>Ready for service</span></div>
          <div className="flow-tag flow-tag-bottom"><div className="flow-tag-check">✓</div><span>Every detail, handled</span></div>
        </div>
      </div>
      <div className="brand-panel-footer"><span>Built for the rhythm of hospitality</span><span>01 — 03</span></div>
    </section>

    <section className="login-form-panel">
      <div className="login-form-wrap auth-form-wrap">
        <div className="mobile-login-mark"><div><Utensils size={18} /></div><span>DineFlow POS</span></div>
        <div className="login-heading">
          <div className="login-eyebrow">{mode === 'signin' ? 'Welcome back' : 'Get started'}</div>
          <h2>{mode === 'signin' ? 'Sign in to your workspace' : 'Create your restaurant account'}</h2>
          <p>{mode === 'signin' ? 'Use your restaurant account to continue.' : 'Set up a personal account to start using DineFlow.'}</p>
        </div>

        <div className="auth-mode-tabs" role="tablist" aria-label="Account action">
          <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'auth-tab-active' : ''} onClick={() => switchMode('signin')}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'auth-tab-active' : ''} onClick={() => switchMode('signup')}><UserRoundPlus size={14} /> Create account</button>
        </div>

        <div className="auth-role-tabs" role="group" aria-label="Choose account role">
          <button type="button" aria-pressed={role === 'ADMIN'} className={role === 'ADMIN' ? 'auth-role-active' : ''} onClick={() => { setRole('ADMIN'); setError('') }}>Admin</button>
          <button type="button" aria-pressed={role === 'CASHIER'} className={role === 'CASHIER' ? 'auth-role-active' : ''} onClick={() => { setRole('CASHIER'); setError('') }}>Cashier</button>
        </div>

        <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
          {mode === 'signup' ? <>
            <TextInput className="login-field" id="fullName" label="Full name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your name" minLength={2} maxLength={100} required />
            <TextInput className="login-field" id="email" label="Email address" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@restaurant.com" maxLength={254} required />
            <TextInput className="login-field" id="username" label="Username" hint="3–40 characters: letters, numbers, dots, underscores, or hyphens." autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="For example, swati.yadawar" minLength={3} maxLength={40} pattern={'[A-Za-z0-9._\\-]+'} required />
          </> : <TextInput className="login-field" id="identity" label="Username or email" autoComplete="username" value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder="Enter your username or email" required />}
          <TextInput className="login-field password-field" id="password" label="Password" afterLabel={<span><LockKeyhole size={13} /> {mode === 'signup' ? '12 characters minimum' : 'Secure sign in'}</span>} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'signup' ? 'Create a strong password' : 'Enter your password'} minLength={mode === 'signup' ? 12 : undefined} maxLength={128} required endAdornment={<button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>} />
          {mode === 'signup' && <p className="auth-role-note">{role === 'ADMIN' ? 'Admin sign-up is only for a workspace without an Admin account. Existing Admins should sign in.' : 'Cashier accounts can take orders and record payments.'}</p>}
          {error && <div className="login-error" role="alert">{error}</div>}
          <Button className="login-submit" type="submit" loading={busy}>{busy ? (mode === 'signin' ? 'Signing in' : 'Creating account') : (mode === 'signin' ? 'Sign in' : 'Create account')}{!busy && <MoveRight size={17} />}</Button>
        </form>
        <div className="login-support">{mode === 'signin' ? 'New to DineFlow? Create an account to get started.' : 'Already have an account? Sign in with your saved credentials.'}</div>
      </div>
    </section>
  </main>
}
