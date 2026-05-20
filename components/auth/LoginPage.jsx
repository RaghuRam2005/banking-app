'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import AccountOpenHandler from './AccountOpenHandler'
import styles from './LoginPage.module.css'

function LoginInner() {
  const [mode, setMode]     = useState('login')
  const [email, setEmail]   = useState('')
  const [password, setPass] = useState('')
  const [role, setRole]     = useState('user')
  const [error, setError]   = useState('')
  const [busy, setBusy]     = useState(false)

  const { login, register, showToast } = useAuth()
  const router = useRouter()
  const params = useSearchParams()

  const openType = params.get('open')   // e.g. "savings", "fd" — from landing page
  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? 'admin@novabank.local'

  const submit = async () => {
    if (!email || !password) { setError('All fields are required'); return }
    setBusy(true)
    setError('')
    try {
      if (mode === 'register') {
        await register(email, password)
        showToast('Account created — please log in', 'success')
        setMode('login')
      } else {
        await login(email, password)

        const userRole = role === 'admin' || email === ADMIN_EMAIL ? 'admin' : 'user'
        document.cookie = `nova-user-session=${JSON.stringify({ email, role: userRole })}; path=/`

        // AccountOpenHandler will fire if openType is set
        if (!openType) {
          router.push(role === 'admin' || email === ADMIN_EMAIL ? '/admin' : '/dashboard')
        }
        // If openType is set, AccountOpenHandler takes over and redirects to /dashboard
      }
    } catch (err) {
      setError(err.message ?? 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      {/* Handles ?open= param — creates account after login then redirects */}
      <AccountOpenHandler />

      <div className={styles.card}>
        <button
          type="button"
          onClick={() => router.push('/')}
          style={{ position: 'absolute', top: '1rem', right: '1rem', border: 'none', background: 'transparent', fontSize: '1.5rem', cursor: 'pointer', color: '#fff' }}
        >
          ×
        </button>
        <div className={styles.logoWrap}>
          <span className={styles.logoGold}>Nova</span>
          <span className={styles.logoSub}>Bank</span>
        </div>

        {openType && (
          <div className={styles.openBanner}>
            Opening a <strong>{openType}</strong> account after sign-in
          </div>
        )}

        <h1 className={styles.title}>
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p className={styles.subtitle}>
          {mode === 'login' ? 'Sign in to your dashboard' : 'Join Nova Bank today'}
        </p>

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input className={styles.input} type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input className={styles.input} type="password" value={password}
              onChange={(e) => setPass(e.target.value)} placeholder="••••••••"
              onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </div>

          {mode === 'login' && !openType && (
            <div className={styles.field}>
              <label className={styles.label}>Role</label>
              <div className={styles.roleToggle}>
                {['user', 'admin'].map((r) => (
                  <button key={r}
                    className={`${styles.roleBtn} ${role === r ? styles.roleActive : ''}`}
                    onClick={() => setRole(r)} type="button">
                    {r === 'user' ? '👤 Customer' : '🔐 Admin'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <button className={styles.submitBtn} onClick={submit} disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          <button className={styles.switchBtn}
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
            {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  )
}
