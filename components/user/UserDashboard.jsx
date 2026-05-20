'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { queryDocs, createDoc, updateDoc, setDoc } from '@/lib/firebaseRest'
import { initiateInterbankTransfer, fetchHubBanks, registerAccountInHub } from '@/lib/bmsTransfers'
import styles from './UserDashboard.module.css'

const BANK_ID   = process.env.NEXT_PUBLIC_BANK_ID
const IFSC_CODE = process.env.NEXT_PUBLIC_IFSC_CODE

const ACCOUNT_TYPES = [
  { id: 'savings',  label: 'Savings Account',      desc: 'Daily interest, easy access',              icon: '◈' },
  { id: 'current',  label: 'Current Account',       desc: 'Unlimited transactions, overdraft',        icon: '⊕' },
  { id: 'fd',       label: 'Fixed Deposit',          desc: 'Guaranteed returns up to 7.5% p.a.',      icon: '⊗' },
  { id: 'premium',  label: 'Premium Wealth',         desc: 'Exclusive privileges for high net worth',  icon: '✦' },
]

const LOAN_RATES = { personal: 14, home: 8.5, car: 10, education: 9 }

function calcEMI(principal, rate, years) {
  const r = rate / 12 / 100
  const n = years * 12
  if (r === 0) return principal / n
  return Math.round((principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1))
}

function generateAccountNumber() {
  return String(Math.floor(100000000000 + Math.random() * 900000000000))
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
export default function UserDashboard() {
  const { user, showToast, logout } = useAuth()
  const router = useRouter()

  const [tab, setTab]               = useState('accounts')
  const [accounts, setAccounts]     = useState([])
  const [activeAccount, setActive]  = useState(null)
  const [transactions, setTxns]     = useState([])
  const [loans, setLoans]           = useState([])
  const [hubBanks, setHubBanks]     = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => { if (user) loadAll() }, [user])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [accs, userLoans, banks] = await Promise.all([
        queryDocs('accounts', [{ field: 'ownerId', op: 'EQUAL', value: user.uid }]),
        queryDocs('loans',    [{ field: 'userId',  op: 'EQUAL', value: user.uid }]),
        fetchHubBanks(),
      ])

      const validAccs = accs ?? []
      setAccounts(validAccs)

      setActive((prev) => {
        if (prev) {
          const refreshed = validAccs.find((a) => a._id === prev._id)
          return refreshed ?? validAccs[0] ?? null
        }
        return validAccs[0] ?? null
      })

      setLoans(userLoans ?? [])
      setHubBanks(banks.filter((b) => b.bankId !== BANK_ID))

      if (validAccs.length > 0) {
        const allTxns = await queryDocs('transactions', [
          { field: 'ownerId', op: 'EQUAL', value: user.uid },
        ])
        if (!allTxns || allTxns.length === 0) {
          const perAcc = await Promise.all(
            validAccs.map(async (a) => {
              const outgoing = await queryDocs('transactions', [
                { field: 'fromAccountId', op: 'EQUAL', value: a._id },
              ])

              const incoming = await queryDocs('transactions', [
                { field: 'toAccountId', op: 'EQUAL', value: a._id },
              ])

              return [...(outgoing || []), ...(incoming || [])]
            })
          )

          const uniqueTxns = Array.from(
            new Map(
              perAcc
                .flat()
                .filter(Boolean)
                .map((txn) => [txn.transactionId || txn._id, txn])
            ).values()
          )

          setTxns(uniqueTxns)
        } else {
          setTxns(allTxns)
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Create account with status = 'pending' — admin must approve
  const createAccount = async (accountType) => {
    const accountNumber = generateAccountNumber()
    const acc = await createDoc('accounts', {
      ownerId:       user.uid,
      ownerEmail:    user.email,
      accountNumber,
      type:          accountType,
      balance:       0,
      currency:      'INR',
      status:        'pending',          // ← pending until admin approves
    })
    // Ensure user profile exists
    await setDoc('users', user.uid, {
      uid: user.uid, email: user.email, kycStatus: 'pending',
    })
    showToast(`${accountType} account request submitted — pending admin approval`, 'info')
    await loadAll()
    setTab('accounts')
  }

  const NAV = [
    { id: 'accounts',  label: 'Accounts',        icon: '◈' },
    { id: 'portfolio', label: 'Portfolio',        icon: '◉' },
    { id: 'transfer',  label: 'Transfer Center',  icon: '⇄' },
    { id: 'loans',     label: 'Loan Management',  icon: '✦' },
  ]

  return (
    <div className={styles.root}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <button
          onClick={async () => {
            document.cookie = 'nova-user-session=; Max-Age=0; path=/'
            await logout()
            router.push('/')
          }}
          style={{ marginBottom: '1rem', padding: '0.7rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
        >
          Logout
        </button>
        <div className={styles.sidebarLogo}>
          <span className={styles.logoGold}>Nova</span>
          <span className={styles.logoSub}>Bank</span>
        </div>

        {accounts.length > 0 && (
          <div className={styles.accountSwitcher}>
            <div className={styles.switcherLabel}>Active Account</div>
            {accounts.map((acc) => (
              <button
                key={acc._id}
                className={`${styles.switcherItem} ${activeAccount?._id === acc._id ? styles.switcherActive : ''}`}
                onClick={() => { setActive(acc); setTab('portfolio') }}
              >
                <div className={styles.switcherType}>{acc.type}</div>
                <div className={styles.switcherNum}>••••{acc.accountNumber?.slice(-4)}</div>
                <div className={styles.switcherBal}>
                  {acc.status === 'pending'
                    ? <span style={{ color: '#c4973a', fontSize: '0.7rem' }}>⏳ Pending Approval</span>
                    : acc.status === 'rejected'
                    ? <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>✕ Rejected</span>
                    : `₹${((acc.balance ?? 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                  }
                </div>
              </button>
            ))}
          </div>
        )}

        <nav className={styles.sidebarNav}>
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`${styles.navItem} ${tab === item.id ? styles.navActive : ''}`}
              onClick={() => setTab(item.id)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Main ── */}
      <main className={styles.main}>
        {loading && <div className={styles.loading}>Loading your data…</div>}

        {!loading && tab === 'accounts' && (
          <AccountsTab
            accounts={accounts}
            activeAccount={activeAccount}
            onSelect={(acc) => { setActive(acc); setTab('portfolio') }}
            onCreate={createAccount}
          />
        )}
        {!loading && tab === 'portfolio' && (
          <Portfolio
            account={activeAccount}
            allAccounts={accounts}
            transactions={transactions}
            onSwitchAccount={(acc) => setActive(acc)}
          />
        )}
        {!loading && tab === 'transfer' && (
          <TransferCenter
            accounts={accounts}
            activeAccount={activeAccount}
            hubBanks={hubBanks}
            onComplete={loadAll}
            showToast={showToast}
          />
        )}
        {!loading && tab === 'loans' && (
          <LoanManagement
            account={activeAccount}
            accounts={accounts}
            loans={loans}
            userId={user.uid}
            onComplete={loadAll}
            showToast={showToast}
          />
        )}
      </main>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// ACCOUNTS TAB
// ─────────────────────────────────────────────────────────────
function AccountsTab({ accounts, activeAccount, onSelect, onCreate }) {
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [busy, setBusy]         = useState(false)

  const handleCreate = async () => {
    if (!selected) return
    setBusy(true)
    try {
      await onCreate(selected)
      setShowForm(false)
      setSelected(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>My Accounts</h2>
        <button className={styles.newAccountBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancel' : '+ Open New Account'}
        </button>
      </div>

      {/* New account form */}
      {showForm && (
        <div className={styles.newAccountForm}>
          <h3 className={styles.cardTitle}>Choose Account Type</h3>
          <p style={{ color: '#a08c5a', fontSize: '0.8rem', marginBottom: '1rem' }}>
            Your request will be reviewed by our admin team. You'll be notified once approved.
          </p>
          <div className={styles.accountGrid}>
            {ACCOUNT_TYPES.map((t) => (
              <button
                key={t.id}
                className={`${styles.accountOption} ${selected === t.id ? styles.accountSelected : ''}`}
                onClick={() => setSelected(t.id)}
              >
                <div className={styles.accountOptionIcon}>{t.icon}</div>
                <div className={styles.accountOptionName}>{t.label}</div>
                <div className={styles.accountOptionDesc}>{t.desc}</div>
              </button>
            ))}
          </div>
          <button className={styles.submitBtn} disabled={!selected || busy} onClick={handleCreate}>
            {busy ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      )}

      {/* Existing accounts grid */}
      {accounts.length === 0 && !showForm ? (
        <div className={styles.emptyAccounts}>
          <div className={styles.emptyIcon}>◈</div>
          <div className={styles.emptyTitle}>No accounts yet</div>
          <p className={styles.emptyDesc}>Submit a request to open your first Nova Bank account.</p>
          <button className={styles.submitBtn} style={{ maxWidth: 200, marginTop: '1rem' }} onClick={() => setShowForm(true)}>
            Open Account
          </button>
        </div>
      ) : (
        <div className={styles.accountCards}>
          {accounts.map((acc) => (
            <div
              key={acc._id}
              className={`${styles.accountCard} ${activeAccount?._id === acc._id ? styles.accountCardActive : ''}`}
            >
              <div className={styles.accountCardTop}>
                <span className={styles.accountCardType}>{acc.type}</span>
                <span className={`${styles.accountCardStatus} ${
                  acc.status === 'active'   ? styles.statusActive   :
                  acc.status === 'pending'  ? styles.statusPending  :
                  acc.status === 'rejected' ? styles.statusRejected : ''
                }`}>
                  {acc.status === 'pending' ? '⏳ pending' : acc.status}
                </span>
              </div>
              <div className={styles.accountCardBalance}>
                {acc.status === 'pending'
                  ? <span style={{ color: '#c4973a', fontSize: '0.9rem' }}>Awaiting admin approval</span>
                  : acc.status === 'rejected'
                  ? <span style={{ color: '#ef4444', fontSize: '0.9rem' }}>Request rejected</span>
                  : `₹${((acc.balance ?? 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                }
              </div>
              <div className={styles.accountCardNumber}>{acc.accountNumber}</div>
              <div className={styles.accountCardIfsc}>{IFSC_CODE}</div>
              {acc.status === 'active' && (
                <button className={styles.accountCardBtn} onClick={() => onSelect(acc)}>
                  View Portfolio →
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PORTFOLIO
// ─────────────────────────────────────────────────────────────
function Portfolio({ account, allAccounts, transactions, onSwitchAccount }) {
  if (!account) {
    return (
      <div>
        <h2 className={styles.sectionTitle}>Portfolio Overview</h2>
        <div className={styles.emptyAccounts}>
          <div className={styles.emptyIcon}>◈</div>
          <div className={styles.emptyTitle}>No account selected</div>
          <p className={styles.emptyDesc}>Go to the Accounts tab to open or select an account.</p>
        </div>
      </div>
    )
  }

  if (account.status !== 'active') {
    return (
      <div>
        <h2 className={styles.sectionTitle}>Portfolio Overview</h2>
        <div className={styles.emptyAccounts}>
          <div className={styles.emptyIcon}>{account.status === 'pending' ? '⏳' : '✕'}</div>
          <div className={styles.emptyTitle}>
            {account.status === 'pending' ? 'Account pending approval' : 'Account rejected'}
          </div>
          <p className={styles.emptyDesc}>
            {account.status === 'pending'
              ? 'Your account request is under review. You will be notified once it is approved.'
              : 'This account request was rejected. Please contact support or open a new account.'}
          </p>
        </div>
      </div>
    )
  }

  const myTxns = transactions
    .filter((t) => t.fromAccountId === account._id || t.toAccountId === account._id)
    .slice(0, 20)

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Portfolio Overview</h2>
        {allAccounts.filter(a => a.status === 'active').length > 1 && (
          <select
            className={styles.accountSwitchSelect}
            value={account._id}
            onChange={(e) => onSwitchAccount(allAccounts.find((a) => a._id === e.target.value))}
          >
            {allAccounts.filter(a => a.status === 'active').map((a) => (
              <option key={a._id} value={a._id}>
                {a.type} — ••••{a.accountNumber?.slice(-4)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Available Balance</div>
          <div className={styles.statValue}>
            ₹{((account.balance ?? 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Account Number</div>
          <div className={styles.statValue}>{account.accountNumber ?? '—'}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>IFSC Code</div>
          <div className={styles.statValue}>{IFSC_CODE}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Account Type</div>
          <div className={styles.statValue} style={{ textTransform: 'capitalize' }}>{account.type ?? '—'}</div>
        </div>
      </div>

      <h3 className={styles.subSection}>Recent Transactions</h3>
      <table className={styles.table}>
        <thead>
          <tr><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr>
        </thead>
        <tbody>
          {myTxns.map((t) => (
            <tr key={t._id}>
              <td>
                <span className={t.direction === 'credit' ? styles.credit : styles.debit}>
                  {t.direction === 'credit' ? '↑' : '↓'}
                </span>{' '}
                {t.type === 'interbank'
                  ? `Interbank (${t.fromBankId ?? t.toBankId})`
                  : t.type === 'own_account'
                  ? 'Own Account Transfer'
                  : 'Internal'}
              </td>
              <td className={t.direction === 'credit' ? styles.credit : styles.debit}>
                {t.direction === 'credit' ? '+' : '−'}₹{((t.amount ?? 0) / 100).toLocaleString('en-IN')}
              </td>
              <td><span className={`${styles.badge} ${styles[t.status]}`}>{t.status}</span></td>
              <td>{t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN') : '—'}</td>
            </tr>
          ))}
          {myTxns.length === 0 && (
            <tr><td colSpan={4} className={styles.emptyState}>No transactions yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TRANSFER CENTER — only active accounts allowed
// ─────────────────────────────────────────────────────────────
function TransferCenter({ accounts, activeAccount, hubBanks, onComplete, showToast }) {
  const activeAccounts = accounts.filter((a) => a.status === 'active')
  const [mode, setMode] = useState('own')
  const [form, setForm] = useState({
    fromAccountId: activeAccount?.status === 'active' ? activeAccount?._id ?? '' : activeAccounts[0]?._id ?? '',
    toAccountId:   '',
    toAccountNum:  '',
    amount:        '',
    bank:          '',
    transferMode:  'imps',
  })
  const [busy, setBusy] = useState(false)

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const fromAccount = activeAccounts.find((a) => a._id === form.fromAccountId) ?? activeAccounts[0]

  if (activeAccounts.length === 0) {
    return (
      <div>
        <h2 className={styles.sectionTitle}>Transfer Center</h2>
        <div className={styles.emptyAccounts}>
          <div className={styles.emptyIcon}>⇄</div>
          <div className={styles.emptyTitle}>No active accounts</div>
          <p className={styles.emptyDesc}>Transfers are only available for approved active accounts.</p>
        </div>
      </div>
    )
  }

  const submitOwn = async () => {
    if (!form.fromAccountId || !form.toAccountId || !form.amount) {
      showToast('Fill in all fields', 'error'); return
    }
    if (form.fromAccountId === form.toAccountId) {
      showToast('Cannot transfer to the same account', 'error'); return
    }
    const amtPaise = Math.round(parseFloat(form.amount) * 100)
    if (amtPaise <= 0) { showToast('Invalid amount', 'error'); return }
    if ((fromAccount?.balance ?? 0) < amtPaise) {
      showToast('Insufficient balance', 'error'); return
    }
    setBusy(true)
    try {
      const toAcc = activeAccounts.find((a) => a._id === form.toAccountId)
      await updateDoc('accounts', form.fromAccountId, { balance: fromAccount.balance - amtPaise })
      await updateDoc('accounts', form.toAccountId,   { balance: (toAcc.balance ?? 0) + amtPaise })
      await createDoc('transactions', {
        direction: 'debit', fromAccountId: form.fromAccountId,
        toAccountId: form.toAccountId, amount: amtPaise,
        currency: 'INR', status: 'completed', type: 'own_account',
      })
      showToast(`₹${form.amount} moved between your accounts`, 'success')
      setForm((p) => ({ ...p, toAccountId: '', amount: '' }))
      onComplete()
    } catch (err) { showToast(err.message, 'error') }
    finally { setBusy(false) }
  }

  const submitInternal = async () => {
    if (!form.fromAccountId || !form.toAccountNum || !form.amount) {
      showToast('Fill in all fields', 'error'); return
    }
    const amtPaise = Math.round(parseFloat(form.amount) * 100)
    if (amtPaise <= 0) { showToast('Invalid amount', 'error'); return }
    if ((fromAccount?.balance ?? 0) < amtPaise) {
      showToast('Insufficient balance', 'error'); return
    }
    setBusy(true)
    try {
      const toAccounts = await queryDocs('accounts', [
        { field: 'accountNumber', op: 'EQUAL', value: form.toAccountNum },
        { field: 'status', op: 'EQUAL', value: 'active' },
      ])
      if (!toAccounts || toAccounts.length === 0) throw new Error('Active account not found in Nova Bank')
      const toAcc = toAccounts[0]
      if (toAcc._id === form.fromAccountId) throw new Error('Cannot transfer to the same account')
      await updateDoc('accounts', form.fromAccountId, { balance: fromAccount.balance - amtPaise })
      await updateDoc('accounts', toAcc._id, { balance: (toAcc.balance ?? 0) + amtPaise })
      await createDoc('transactions', {
        direction: 'debit', fromAccountId: form.fromAccountId,
        toAccountId: toAcc._id, amount: amtPaise,
        currency: 'INR', status: 'completed', type: 'internal',
      })
      showToast(`₹${form.amount} sent successfully`, 'success')
      setForm((p) => ({ ...p, toAccountNum: '', amount: '' }))
      onComplete()
    } catch (err) { showToast(err.message, 'error') }
    finally { setBusy(false) }
  }

  const submitInterbank = async () => {
    if (!form.fromAccountId || !form.toAccountNum || !form.amount || !form.bank) {
      showToast('Fill in all fields', 'error'); return
    }
    const amtPaise = Math.round(parseFloat(form.amount) * 100)
    if (amtPaise <= 0) { showToast('Invalid amount', 'error'); return }
    if ((fromAccount?.balance ?? 0) < amtPaise) {
      showToast('Insufficient balance', 'error'); return
    }
    setBusy(true)
    try {
      await initiateInterbankTransfer({
        fromAccountId: form.fromAccountId,
        toAccountId:   form.toAccountNum,
        toBankId:      form.bank,
        amountPaise:   amtPaise,
        mode:          form.transferMode,
      })
      showToast(`Interbank transfer of ₹${form.amount} initiated`, 'success')
      setForm((p) => ({ ...p, toAccountNum: '', amount: '', bank: '' }))
      onComplete()
    } catch (err) { showToast(err.message, 'error') }
    finally { setBusy(false) }
  }

  const MODES = [
    { id: 'own',       label: 'Between My Accounts', pill: 'Instant' },
    { id: 'internal',  label: 'To Nova Bank User' },
    { id: 'interbank', label: 'To Other Bank',        pill: 'BMS Hub' },
  ]

  return (
    <div>
      <h2 className={styles.sectionTitle}>Transfer Center</h2>

      <div className={styles.modeToggle}>
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`${styles.modeBtn} ${mode === m.id ? styles.modeBtnActive : ''}`}
            onClick={() => setMode(m.id)}
          >
            {m.label}
            <span className={styles.modePill}>{m.pill}</span>
          </button>
        ))}
      </div>

      <div className={styles.transferCard}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>From Account</label>
          <select
            className={styles.fieldSelect}
            value={form.fromAccountId}
            onChange={(e) => set('fromAccountId', e.target.value)}
          >
            {activeAccounts.length === 0 && <option value="">No active accounts</option>}
            {activeAccounts.map((a) => (
              <option key={a._id} value={a._id}>
                {a.type} — ••••{a.accountNumber?.slice(-4)} — ₹{((a.balance ?? 0) / 100).toLocaleString('en-IN')}
              </option>
            ))}
          </select>
        </div>

        {mode === 'own' && (
          <>
            <div className={styles.transferNote}>
              Move money instantly between your own Nova Bank accounts.
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>To Account</label>
              <select
                className={styles.fieldSelect}
                value={form.toAccountId}
                onChange={(e) => set('toAccountId', e.target.value)}
              >
                <option value="">Select account…</option>
                {activeAccounts
                  .filter((a) => a._id !== form.fromAccountId)
                  .map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.type} — ••••{a.accountNumber?.slice(-4)}
                    </option>
                  ))}
              </select>
            </div>
            <Field label="Amount (₹)" value={form.amount} onChange={(v) => set('amount', v)} placeholder="0.00" type="number" />
            <button className={styles.submitBtn} onClick={submitOwn} disabled={busy || activeAccounts.length < 2}>
              {activeAccounts.length < 2 ? 'Need at least 2 active accounts' : busy ? 'Processing…' : 'Transfer Now'}
            </button>
          </>
        )}

        {mode === 'internal' && (
          <>
            <div className={styles.transferNote}>
              Send to any active Nova Bank account number — settled instantly.
            </div>
            <Field label="Recipient Account Number" value={form.toAccountNum} onChange={(v) => set('toAccountNum', v)} placeholder="12-digit account number" />
            <Field label="Amount (₹)" value={form.amount} onChange={(v) => set('amount', v)} placeholder="0.00" type="number" />
            <button className={styles.submitBtn} onClick={submitInternal} disabled={busy}>
              {busy ? 'Processing…' : 'Send Money'}
            </button>
          </>
        )}

        {mode === 'interbank' && (
          <>
            <div className={styles.transferNote}>
              Cross-bank transfer via the BMS Network. Deduction is immediate; the destination bank credits in real time.
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Destination Bank</label>
              <select className={styles.fieldSelect} value={form.bank} onChange={(e) => set('bank', e.target.value)}>
                <option value="">Select bank…</option>
                {hubBanks.map((b) => (
                  <option key={b.bankId} value={b.bankId}>{b.bankName} ({b.bankId})</option>
                ))}
              </select>
            </div>
            <Field label="Recipient Account Number (at destination bank)" value={form.toAccountNum} onChange={(v) => set('toAccountNum', v)} placeholder="12-digit account number" />
            <Field label="Amount (₹)" value={form.amount} onChange={(v) => set('amount', v)} placeholder="0.00" type="number" />
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Transfer Mode</label>
              <div className={styles.radioGroup}>
                {['imps', 'neft'].map((m) => (
                  <label key={m} className={styles.radioLabel}>
                    <input type="radio" name="tmode" value={m} checked={form.transferMode === m} onChange={() => set('transferMode', m)} />
                    {m.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>
            <button className={styles.submitBtn} onClick={submitInterbank} disabled={busy}>
              {busy ? 'Initiating…' : 'Send Interbank Transfer'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// LOAN MANAGEMENT
// ─────────────────────────────────────────────────────────────
function LoanManagement({ account, accounts, loans, userId, onComplete, showToast }) {
  const activeAccounts = accounts.filter((a) => a.status === 'active')
  const [form, setForm]   = useState({ type: 'personal', amount: '', years: 5, accountId: account?.status === 'active' ? account?._id ?? '' : activeAccounts[0]?._id ?? '' })
  const [busy, setBusy]   = useState(false)
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const rate     = LOAN_RATES[form.type] ?? 14
  const amtPaise = Math.round(parseFloat(form.amount || 0) * 100)
  const emi      = amtPaise > 0 ? calcEMI(amtPaise, rate, Number(form.years)) : 0

  const applyLoan = async () => {
    if (!form.amount || amtPaise <= 0) return
    if (!form.accountId) { showToast('Select a disbursement account', 'error'); return }
    setBusy(true)
    try {
      await createDoc('loans', {
        userId, type: form.type, amount: amtPaise, emi,
        durationYears: Number(form.years), rate,
        status: 'pending', accountId: form.accountId,
      })
      showToast("Loan application submitted! You'll be notified by email.", 'success')
      onComplete()
    } catch (err) { showToast(err.message, 'error') }
    finally { setBusy(false) }
  }

  return (
    <div>
      <h2 className={styles.sectionTitle}>Loan Management</h2>
      <div className={styles.loanGrid}>
        <div className={styles.loanCard}>
          <h3 className={styles.cardTitle}>Apply for a Loan</h3>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Loan Type</label>
            <select className={styles.fieldSelect} value={form.type} onChange={(e) => set('type', e.target.value)}>
              {Object.entries(LOAN_RATES).map(([t, r]) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} — {r}% p.a.</option>
              ))}
            </select>
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Disburse to Account</label>
            <select className={styles.fieldSelect} value={form.accountId} onChange={(e) => set('accountId', e.target.value)}>
              <option value="">Select account…</option>
              {activeAccounts.map((a) => (
                <option key={a._id} value={a._id}>{a.type} — ••••{a.accountNumber?.slice(-4)}</option>
              ))}
            </select>
          </div>
          <Field label="Loan Amount (₹)" value={form.amount} onChange={(v) => set('amount', v)} placeholder="500000" type="number" />
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Duration: {form.years} years</label>
            <input type="range" min={1} max={30} step={1} value={form.years}
              onChange={(e) => set('years', e.target.value)} className={styles.slider} />
          </div>
          {emi > 0 && (
            <div className={styles.emiPreview}>
              <span>Estimated EMI</span>
              <span className={styles.emiValue}>₹{(emi / 100).toLocaleString('en-IN')}/mo</span>
            </div>
          )}
          <button className={styles.submitBtn} onClick={applyLoan} disabled={busy || activeAccounts.length === 0}>
            {activeAccounts.length === 0 ? 'Need an active account first' : busy ? 'Submitting…' : 'Submit Application'}
          </button>
        </div>

        <div className={styles.loanCard}>
          <h3 className={styles.cardTitle}>My Loans</h3>
          {loans.length === 0 ? (
            <div className={styles.emptyState}>No loans yet</div>
          ) : (
            <div className={styles.loanList}>
              {loans.map((l) => {
                const repayAccount = activeAccounts.find((a) => a._id === l.accountId) ?? activeAccounts[0]
                return (
                  <div key={l._id} className={styles.loanItem}>
                    <div className={styles.loanType}>{l.type}</div>
                    <div className={styles.loanAmount}>₹{((l.amount ?? 0) / 100).toLocaleString('en-IN')}</div>
                    <div className={styles.loanEmi}>EMI: ₹{((l.emi ?? 0) / 100).toLocaleString('en-IN')}/mo</div>
                    <span className={`${styles.badge} ${styles[l.status]}`}>{l.status}</span>
                    {l.status === 'approved' && repayAccount && (
                      <RepayButton loan={l} account={repayAccount} onComplete={onComplete} showToast={showToast} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RepayButton({ loan, account, onComplete, showToast }) {
  const [busy, setBusy] = useState(false)
  const repay = async () => {
    const emi = loan.emi ?? 0
    if ((account?.balance ?? 0) < emi) { showToast('Insufficient balance for EMI', 'error'); return }
    setBusy(true)
    try {
      await updateDoc('accounts', account._id, { balance: account.balance - emi })
      await createDoc('transactions', {
        direction: 'debit', fromAccountId: account._id,
        amount: emi, currency: 'INR', status: 'completed',
        type: 'loan_repayment', loanId: loan._id,
      })
      showToast('EMI paid successfully ✓', 'success')
      onComplete()
    } catch (err) { showToast(err.message, 'error') }
    finally { setBusy(false) }
  }
  return (
    <button className={styles.repayBtn} onClick={repay} disabled={busy}>
      {busy ? '…' : 'Pay EMI'}
    </button>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div className={styles.fieldGroup}>
      <label className={styles.fieldLabel}>{label}</label>
      <input className={styles.fieldInput} type={type} value={value}
        placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
