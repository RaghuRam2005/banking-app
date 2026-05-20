'use client'
/**
 * AccountOpenHandler.jsx
 * ─────────────────────────────────────────────────────────────
 * Reads the ?open=<accountType> search param that AccountTypesSection
 * sets when a user clicks an account from the landing page.
 * After the user logs in / registers, this triggers account creation
 * automatically and redirects to the dashboard.
 *
 * Mount this inside the /login page layout.
 */
import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { queryDocs, createDoc, setDoc } from '@/lib/firebaseRest'

const IFSC_CODE = process.env.NEXT_PUBLIC_IFSC_CODE

function generateAccountNumber() {
  return String(Math.floor(100000000000 + Math.random() * 900000000000))
}

export default function AccountOpenHandler() {
  const params  = useSearchParams()
  const router  = useRouter()
  const { user, showToast } = useAuth()

  const accountType = params.get('open')

  useEffect(() => {
    if (!user || !accountType) return
    handleOpen()
  }, [user, accountType])

  const handleOpen = async () => {
    try {
      // Don't create a duplicate if user already has this type
      const existing = await queryDocs('accounts', [
        { field: 'ownerId', op: 'EQUAL', value: user.uid },
        { field: 'type',    op: 'EQUAL', value: accountType },
      ])
      if (existing && existing.length > 0) {
        showToast(`You already have a ${accountType} account`, 'info')
        router.push('/dashboard')
        return
      }

      const accountNumber = generateAccountNumber()
      const acc = await createDoc('accounts', {
        ownerId: user.uid, accountNumber,
        type: accountType, balance: 0,
        currency: 'INR', status: 'pending',
      })
      await setDoc('users', user.uid, {
        uid: user.uid, email: user.email, kycStatus: 'pending',
      })
      showToast(`${accountType} account request submitted — pending admin approval`, 'info')
      router.push('/dashboard')
    } catch (err) {
      console.error(err)
      router.push('/dashboard')
    }
  }

  return null  // No UI — this is a side-effect only component
}
