'use client'
/**
 * AuthContext.jsx
 * Manages:
 *  - Private Firebase Auth (user identity)
 *  - Hub sign-in (triggered immediately after private login)
 *  - REST token injection for authenticated REST calls
 *  - BMS listeners lifecycle (start on login, stop on logout)
 */

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { privateAuth } from '@/lib/firebasePrivate'
import { signInToHub } from '@/lib/hubAuth'
import { setRestToken, clearRestToken, getDoc as restGet, queryDocs } from '@/lib/firebaseRest'
import { startIncomingListener, startStatusListener } from '@/lib/bmsTransfers'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null)   // Firebase Auth user
  const [profile, setProfile]     = useState(null)   // Firestore user profile
  const [loading, setLoading]     = useState(true)
  const [toast, setToast]         = useState(null)

  const unsubIncoming = useRef(null)
  const unsubStatus   = useRef(null)

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type, id: Date.now() })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const stopListeners = useCallback(() => {
    unsubIncoming.current?.()
    unsubStatus.current?.()
    unsubIncoming.current = null
    unsubStatus.current   = null
  }, [])

  const startListeners = useCallback(() => {
    stopListeners()
    unsubIncoming.current = startIncomingListener(
      (t) => showToast(`₹${(t.amount / 100).toLocaleString('en-IN')} received from ${t.fromBankId}`, 'success'),
      (t, err) => showToast(`Incoming transfer failed: ${err.message}`, 'error')
    )
    unsubStatus.current = startStatusListener((t) => {
      if (t.status === 'completed')
        showToast(`Transfer ${t.transferId?.slice(0, 8)} completed ✓`, 'success')
      else
        showToast(`Transfer failed: ${t.failureReason}`, 'error')
    })
  }, [showToast, stopListeners])

  useEffect(() => {
    const unsub = onAuthStateChanged(privateAuth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        // Inject token for REST calls
        const token = await firebaseUser.getIdToken()
        setRestToken(token)
        // Sign into hub SDK
        await signInToHub()
        // Load profile
        try {
          const prof = await restGet('users', firebaseUser.uid)
          setProfile(prof)
        } catch (_) {}
        // Start BMS listeners
        startListeners()
      } else {
        setUser(null)
        setProfile(null)
        clearRestToken()
        stopListeners()
      }
      setLoading(false)
    })
    return unsub
  }, [startListeners, stopListeners])

  const login = async (email, password) => {
    const cred = await signInWithEmailAndPassword(privateAuth, email, password)
    return cred.user
  }

  const register = async (email, password) => {
    const cred = await createUserWithEmailAndPassword(privateAuth, email, password)
    return cred.user
  }

  const logout = async () => {
    stopListeners()
    clearRestToken()
    await signOut(privateAuth)
  }

  return (
    <AuthContext.Provider value={{ user, profile, setProfile, loading, login, register, logout, showToast }}>
      {children}
      {toast && <Toast toast={toast} />}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

function Toast({ toast }) {
  const colors = {
    success: '#22c55e',
    error:   '#ef4444',
    info:    '#c4973a',
  }
  return (
    <div style={{
      position: 'fixed', bottom: '2rem', right: '2rem',
      background: '#0f2236',
      border: `1px solid ${colors[toast.type]}`,
      borderRadius: '10px',
      padding: '0.9rem 1.5rem',
      color: '#faf7f0',
      fontFamily: "'DM Sans', sans-serif",
      fontSize: '0.875rem',
      zIndex: 9999,
      boxShadow: `0 8px 32px rgba(0,0,0,0.4)`,
      animation: 'slideUp 0.3s ease',
      maxWidth: '320px',
    }}>
      <span style={{ color: colors[toast.type], marginRight: '0.5rem' }}>
        {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
      </span>
      {toast.msg}
    </div>
  )
}
