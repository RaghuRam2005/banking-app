'use client'
/**
 * KycSubmission.jsx
 * Displayed inside UserDashboard when kycStatus is 'pending' or not set.
 * Users enter their name and PAN — a kyc_applications doc is created
 * in the private DB and the admin is notified via the /api/notify route.
 */
import { useState } from 'react'
import { createDoc } from '@/lib/firebaseRest'
import styles from './KycSubmission.module.css'

export default function KycSubmission({ user, onSubmitted }) {
  const [form, setForm] = useState({ name: '', pan: '', dob: '', address: '' })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!form.name || !form.pan) {
      setError('Name and PAN are required')
      return
    }

    // Basic PAN format check: 5 letters, 4 digits, 1 letter
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
    if (!panRegex.test(form.pan.toUpperCase())) {
      setError('Invalid PAN format (e.g. ABCDE1234F)')
      return
    }

    setBusy(true)
    setError('')

    try {
      await createDoc('kyc_applications', {
        userId:  user.uid,
        email:   user.email,
        name:    form.name,
        pan:     form.pan.toUpperCase(),
        dob:     form.dob,
        address: form.address,
        status:  'pending',
      })

      // Notify admin (fire-and-forget)
      fetch('/api/notify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'kyc_approved',  // re-used as "new submission" to admin — customise template as needed
          to:   process.env.NEXT_PUBLIC_ADMIN_EMAIL,
          data: { name: `New KYC from ${form.name} (${user.email})` },
        }),
      }).catch(() => {})

      setDone(true)
      onSubmitted?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className={styles.successBox}>
        <div className={styles.successIcon}>✓</div>
        <div className={styles.successTitle}>KYC Submitted</div>
        <p className={styles.successDesc}>
          Your application is under review. You'll receive an email once it's processed — typically within 1 business day.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <div className={styles.badge}>KYC Verification Required</div>
      <h3 className={styles.title}>Complete Your Identity Verification</h3>
      <p className={styles.desc}>
        To enable transfers and loans, please verify your identity. All data is stored securely in your private database only.
      </p>

      <div className={styles.form}>
        <Field label="Full Name (as on PAN)" value={form.name}    onChange={(v) => set('name', v)}    placeholder="Rajesh Kumar" />
        <Field label="PAN Number"             value={form.pan}     onChange={(v) => set('pan', v)}     placeholder="ABCDE1234F" />
        <Field label="Date of Birth"          value={form.dob}     onChange={(v) => set('dob', v)}     type="date" />
        <Field label="Address"                value={form.address} onChange={(v) => set('address', v)} placeholder="123 Main St, Mumbai 400001" />

        {error && <div className={styles.error}>{error}</div>}

        <button className={styles.btn} onClick={submit} disabled={busy}>
          {busy ? 'Submitting…' : 'Submit KYC'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <input
        className={styles.input}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
