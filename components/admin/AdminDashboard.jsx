'use client'
/**
 * AdminDashboard.jsx
 * ─────────────────────────────────────────────────────────────
 * Four panels:
 *  1. Account Requests  — approve / deny new bank account requests (notifies user)
 *  2. Account Requests  — approve / reject / hold KYC submissions
 *  3. Loan Management   — approve / reject loan applications
 *  4. Transaction Audit — read-only view of all transactions
 *  5. Network Monitor   — BMS hub connection status
 */
import { useState, useEffect, useCallback } from 'react'
import { hubAuth, hubDb } from '@/lib/firebaseHub'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { queryDocs, updateDoc, listDocs } from '@/lib/firebaseRest'
import { registerBankInHub } from '@/lib/bmsTransfers'
import styles from './AdminDashboard.module.css'

const BANK_ID   = process.env.NEXT_PUBLIC_BANK_ID
const BANK_NAME = process.env.NEXT_PUBLIC_BANK_NAME
const IFSC_CODE = process.env.NEXT_PUBLIC_IFSC_CODE

// ── Notify helper ─────────────────────────────────────────────
async function sendNotification(type, to, data) {
  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, to, data }),
    })
  } catch (err) {
    console.warn('[NOTIFY]', err.message)
  }
}

// ── Main Component ────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter()
  const { logout } = useAuth()
  const [tab, setTab]               = useState('accounts')
  const [accountReqs, setAccountReqs] = useState([])
  const [kycApps, setKycApps]       = useState([])
  const [loanApps, setLoanApps]     = useState([])
  const [txns, setTxns]             = useState([])
  const [hubStatus, setHubStatus]   = useState('connecting')
  const [hubBanks, setHubBanks]     = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    loadData()
    monitorHub()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [accReqs, kyc, loans, allTxns] = await Promise.all([
        queryDocs('accounts', [{ field: 'status', op: 'EQUAL', value: 'pending' }]),
        queryDocs('kyc_applications', [{ field: 'status', op: 'EQUAL', value: 'pending' }]),
        queryDocs('loans', [{ field: 'status', op: 'EQUAL', value: 'pending' }]),
        listDocs('transactions', 200),
      ])
      setAccountReqs(accReqs ?? [])
      setKycApps(kyc ?? [])
      setLoanApps(loans ?? [])
      setTxns(allTxns ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const monitorHub = () => {
    const unsub = onAuthStateChanged(hubAuth, (user) => {
      setHubStatus(user ? 'connected' : 'disconnected')
    })
    try {
      const q = query(collection(hubDb, 'interbank_transfers'), where('fromBankId', '==', BANK_ID))
      onSnapshot(q, (snap) => { setHubBanks(snap.docs.length) })
    } catch (_) {}
    return unsub
  }

  // ── Account Request Actions ────────────────────────────────
  const approveAccount = async (acc) => {
    await updateDoc('accounts', acc._id, { status: 'active', approvedAt: new Date().toISOString() })
    // Notify user via email
    await sendNotification('account_approved', acc.ownerEmail, {
      accountNumber: acc.accountNumber,
      type:          acc.type,
    })
    setAccountReqs((prev) => prev.filter((a) => a._id !== acc._id))
  }

  const denyAccount = async (acc) => {
    const reason = prompt('Denial reason (shown to customer):') || 'Application could not be approved at this time'
    await updateDoc('accounts', acc._id, { status: 'rejected', rejectedAt: new Date().toISOString(), reason })
    await sendNotification('account_rejected', acc.ownerEmail, {
      accountNumber: acc.accountNumber,
      type:          acc.type,
      reason,
    })
    setAccountReqs((prev) => prev.filter((a) => a._id !== acc._id))
  }

  // ── KYC Actions ───────────────────────────────────────────
  const approveKyc = async (app) => {
    await updateDoc('kyc_applications', app._id, { status: 'approved', reviewedAt: new Date().toISOString() })
    await updateDoc('users', app.userId, { kycStatus: 'approved' })
    await sendNotification('kyc_approved', app.email, { name: app.name })
    setKycApps((prev) => prev.filter((a) => a._id !== app._id))
  }

  const rejectKyc = async (app) => {
    const reason = prompt('Rejection reason (shown to customer):') || 'Documents could not be verified'
    await updateDoc('kyc_applications', app._id, { status: 'rejected', reason, reviewedAt: new Date().toISOString() })
    await updateDoc('users', app.userId, { kycStatus: 'rejected' })
    await sendNotification('kyc_rejected', app.email, { name: app.name, reason })
    setKycApps((prev) => prev.filter((a) => a._id !== app._id))
  }

  const holdKyc = async (app) => {
    await updateDoc('kyc_applications', app._id, { status: 'hold' })
    setKycApps((prev) => prev.filter((a) => a._id !== app._id))
  }

  // ── Loan Actions ──────────────────────────────────────────
  const approveLoan = async (loan) => {
    await updateDoc('loans', loan._id, { status: 'approved', approvedAt: new Date().toISOString() })
    const accounts = await queryDocs('accounts', [
      { field: 'ownerId', op: 'EQUAL', value: loan.userId },
      { field: 'status',  op: 'EQUAL', value: 'active' },
    ])
    if (accounts?.length > 0) {
      const acc = accounts.find((a) => a._id === loan.accountId) ?? accounts[0]
      await updateDoc('accounts', acc._id, { balance: (acc.balance ?? 0) + loan.amount })
    }
    const user = await import('@/lib/firebaseRest').then(m => m.getDoc('users', loan.userId))
    if (user?.email) {
      await sendNotification('loan_approved', user.email, {
        name:   user.name ?? 'Customer',
        amount: loan.amount / 100,
        emi:    loan.emi   / 100,
      })
    }
    setLoanApps((prev) => prev.filter((l) => l._id !== loan._id))
  }

  const rejectLoan = async (loan) => {
    const reason = prompt('Rejection reason:') || 'Does not meet eligibility criteria'
    await updateDoc('loans', loan._id, { status: 'rejected', reason })
    const user = await import('@/lib/firebaseRest').then(m => m.getDoc('users', loan.userId))
    if (user?.email) {
      await sendNotification('loan_rejected', user.email, { name: user.name ?? 'Customer', reason })
    }
    setLoanApps((prev) => prev.filter((l) => l._id !== loan._id))
  }

  // ── Hub Sync ──────────────────────────────────────────────
  const syncBankToHub = async () => {
    try {
      await registerBankInHub(BANK_NAME, IFSC_CODE?.slice(0, 4), IFSC_CODE)
      alert('Bank registered in BMS hub successfully!')
    } catch (err) {
      alert('Hub sync failed: ' + err.message)
    }
  }

  const pendingBadge = (count) =>
    count > 0
      ? <span style={{ background: '#ef4444', color: '#fff', borderRadius: '999px', fontSize: '0.7rem', padding: '1px 7px', marginLeft: '6px' }}>{count}</span>
      : null

  // ── Render ────────────────────────────────────────────────
  return (
    <div className={styles.root}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <span className={styles.logoGold}>Nova</span>
          <span className={styles.logoSub}>Admin</span>
        </div>
        <nav className={styles.sidebarNav}>
          {[
            { id: 'accounts',     label: 'Account Requests',     icon: '🏦', count: accountReqs.length },
                        { id: 'loans',        label: 'Loan Management',      icon: '💳', count: loanApps.length },
            { id: 'audit',        label: 'Transaction Audit',    icon: '🔍', count: 0 },
            { id: 'network',      label: 'Network Monitor',      icon: '🌐', count: 0 },
          ].map((item) => (
            <button
              key={item.id}
              className={`${styles.navItem} ${tab === item.id ? styles.navActive : ''}`}
              onClick={() => setTab(item.id)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
              {pendingBadge(item.count)}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={`${styles.hubDot} ${hubStatus === 'connected' ? styles.hubConnected : styles.hubDisconnected}`} />
          <span>Hub: {hubStatus}</span>
          <button
            onClick={async () => {
              document.cookie = 'nova-user-session=; Max-Age=0; path=/'
              await logout()
              router.push('/')
            }}
            style={{ marginTop: '1rem', padding: '0.7rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
          >
            Logout
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        {loading && <div className={styles.loading}>Loading data…</div>}

        {/* ── Account Requests Panel ── */}
        {tab === 'accounts' && !loading && (
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Pending Account Requests</h2>
            {accountReqs.length === 0 ? (
              <div className={styles.emptyState}>No pending account requests ✓</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Account #</th><th>Type</th><th>Owner Email</th><th>Requested</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accountReqs.map((acc) => (
                    <tr key={acc._id}>
                      <td className={styles.mono}>{acc.accountNumber}</td>
                      <td style={{ textTransform: 'capitalize' }}>{acc.type}</td>
                      <td>{acc.ownerEmail ?? acc.ownerId}</td>
                      <td>{acc.createdAt ? new Date(acc.createdAt).toLocaleDateString('en-IN') : '—'}</td>
                      <td>
                        <div className={styles.actions}>
                          <button className={styles.btnApprove} onClick={() => approveAccount(acc)}>Approve</button>
                          <button className={styles.btnReject}  onClick={() => denyAccount(acc)}>Deny</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Loan Management Panel ── */}
        {tab === 'loans' && !loading && (
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Pending Loan Applications</h2>
            {loanApps.length === 0 ? (
              <div className={styles.emptyState}>No pending loan applications ✓</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Loan ID</th><th>Type</th><th>Amount</th><th>EMI</th><th>Duration</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loanApps.map((loan) => (
                    <tr key={loan._id}>
                      <td className={styles.mono}>{loan._id?.slice(0, 8)}</td>
                      <td>{loan.type}</td>
                      <td>₹{((loan.amount ?? 0) / 100).toLocaleString('en-IN')}</td>
                      <td>₹{((loan.emi ?? 0) / 100).toLocaleString('en-IN')}/mo</td>
                      <td>{loan.durationYears} yrs</td>
                      <td>
                        <div className={styles.actions}>
                          <button className={styles.btnApprove} onClick={() => approveLoan(loan)}>Approve</button>
                          <button className={styles.btnReject}  onClick={() => rejectLoan(loan)}>Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Audit Panel ── */}
        {tab === 'audit' && !loading && (
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Transaction Audit Log <span className={styles.readOnly}>(Read-only)</span></h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Ref</th><th>Type</th><th>Direction</th><th>Amount</th><th>Status</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t._id}>
                    <td className={styles.mono}>{(t.transactionId ?? t._id)?.slice(0, 10)}</td>
                    <td>{t.type ?? 'internal'}</td>
                    <td>
                      <span className={t.direction === 'credit' ? styles.credit : styles.debit}>
                        {t.direction === 'credit' ? '↑ Credit' : '↓ Debit'}
                      </span>
                    </td>
                    <td>₹{((t.amount ?? 0) / 100).toLocaleString('en-IN')}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[t.status] ?? ''}`}>{t.status}</span>
                    </td>
                    <td>{t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN') : '—'}</td>
                  </tr>
                ))}
                {txns.length === 0 && (
                  <tr><td colSpan={6} className={styles.emptyState}>No transactions yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Network Monitor Panel ── */}
        {tab === 'network' && (
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>BMS Network Monitor</h2>
            <div className={styles.networkGrid}>
              <div className={styles.networkCard}>
                <div className={styles.networkCardLabel}>Hub Connection</div>
                <div className={`${styles.networkStatus} ${hubStatus === 'connected' ? styles.statusGreen : styles.statusRed}`}>
                  {hubStatus === 'connected' ? '● Connected' : '● Disconnected'}
                </div>
                <div className={styles.networkCardSub}>Firebase SDK via hubAuth</div>
              </div>
              <div className={styles.networkCard}>
                <div className={styles.networkCardLabel}>Bank ID</div>
                <div className={styles.networkValue}>{BANK_ID}</div>
                <div className={styles.networkCardSub}>Your hub identity</div>
              </div>
              <div className={styles.networkCard}>
                <div className={styles.networkCardLabel}>Transfers Sent</div>
                <div className={styles.networkValue}>{hubBanks}</div>
                <div className={styles.networkCardSub}>From this session</div>
              </div>
              <div className={styles.networkCard}>
                <div className={styles.networkCardLabel}>IFSC Code</div>
                <div className={styles.networkValue}>{IFSC_CODE}</div>
                <div className={styles.networkCardSub}>Routing identifier</div>
              </div>
            </div>

            <div className={styles.networkActions}>
              <h3 className={styles.subTitle}>Hub Registry</h3>
              <p className={styles.networkDesc}>
                Register this bank in the BMS hub so other banks can discover and send transfers to you.
                Run this once after initial setup.
              </p>
              <button className={styles.syncBtn} onClick={syncBankToHub}>
                Sync Bank to Hub
              </button>
            </div>

            <div className={styles.networkInfo}>
              {/* Architecture section removed */}
              <div className={styles.archTable}>
                {[
                  
                  ['BMS Hub',       'Firebase SDK (onSnapshot)', 'interbank_transfers, banks, public_accounts'],
                  
                ].map(([layer, method, data]) => (
                  <div key={layer} className={styles.archRow}>
                    <span className={styles.archLayer}>{layer}</span>
                    <span className={styles.archMethod}>{method}</span>
                    <span className={styles.archData}>{data}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
