'use client'
import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useScrollAnimation } from '@/app/ui/useScrollAnimation'
import styles from '@/app/ui/LoanSection.module.css'

/* ── Config ─────────────────────────────────────────────────── */
const loanTypes = [
  {
    id: 'personal',
    label: 'Personal',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    id: 'home',
    label: 'Home',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: 'car',
    label: 'Car',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-1" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    ),
  },
  {
    id: 'education',
    label: 'Education',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
      </svg>
    ),
  },
]

const loanConfig = {
  personal:  { rate: 14,  minAmt: 50000,   maxAmt: 5000000,  defAmt: 500000,  minYrs: 1, maxYrs: 5,  defYrs: 3  },
  home:      { rate: 8.5, minAmt: 1000000,  maxAmt: 50000000, defAmt: 5000000, minYrs: 5, maxYrs: 30, defYrs: 20 },
  car:       { rate: 10,  minAmt: 100000,   maxAmt: 5000000,  defAmt: 800000,  minYrs: 1, maxYrs: 7,  defYrs: 5  },
  education: { rate: 9,   minAmt: 50000,    maxAmt: 2000000,  defAmt: 500000,  minYrs: 1, maxYrs: 15, defYrs: 7  },
}

const documents = {
  personal:  ['Aadhaar & PAN Card', 'Salary Slips (3 months)', 'Bank Statement (6 months)', 'Employment Letter'],
  home:      ['Property Title Documents', 'Income Proof / ITR (2 years)', 'Credit Score Report', 'Property Valuation Report'],
  car:       ['Driving License', 'Income Proof', 'Vehicle Quotation / Invoice', 'Bank Statement (6 months)'],
  education: ['Admission / Offer Letter', 'Academic Records (10th, 12th)', 'Course Fee Structure', "Parent / Guarantor's Income Proof"],
}

/* ── Helpers ─────────────────────────────────────────────────── */
function formatINR(n) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)} Cr`
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1)} L`
  return `₹${n.toLocaleString('en-IN')}`
}

function calcEMI(principal, annualRate, years) {
  const r = annualRate / 12 / 100
  const n = years * 12
  if (r === 0) return principal / n
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

function sliderPct(value, min, max) {
  return `${((value - min) / (max - min)) * 100}%`
}

/* ── Component ───────────────────────────────────────────────── */
export default function LoanSection() {
  const [headerRef, headerVisible] = useScrollAnimation({ threshold: 0.1 })
  const [cardRef,   cardVisible]   = useScrollAnimation({ threshold: 0.1, rootMargin: '0px 0px -40px 0px' })

  const [activeLoan, setActiveLoan] = useState('personal')
  const [amount, setAmount]         = useState(loanConfig.personal.defAmt)
  const [years, setYears]           = useState(loanConfig.personal.defYrs)

  const cfg          = loanConfig[activeLoan]
  const emi          = calcEMI(amount, cfg.rate, years)
  const totalPayment = emi * years * 12
  const totalInterest = totalPayment - amount

  const handleLoanSwitch = useCallback((id) => {
    const c = loanConfig[id]
    setActiveLoan(id)
    setAmount(c.defAmt)
    setYears(c.defYrs)
  }, [])

  return (
    <section id="loans" className={styles.section}>
      <div className={styles.container}>

        {/* Header */}
        <div
          className={`${styles.header} ${headerVisible ? styles.visible : ''}`}
          ref={headerRef}
        >
          <div className={styles.badge}>Loan Solutions</div>
          <h2 className={styles.title}>Finance Your Dreams</h2>
          <p className={styles.desc}>
            Competitive interest rates, minimal documentation, and quick approvals — 
            tailored to every stage of your life.
          </p>
        </div>

        {/* Two-column layout */}
        <div
          className={`${styles.grid} ${cardVisible ? styles.gridVisible : ''}`}
          ref={cardRef}
        >
          {/* ── LEFT: Configurator ── */}
          <div className={styles.configurator}>

            {/* Loan type tabs */}
            <div className={styles.tabGroup}>
              <p className={styles.tabLabel}>Loan Type</p>
              <div className={styles.tabs}>
                {loanTypes.map((lt) => (
                  <button
                    key={lt.id}
                    onClick={() => handleLoanSwitch(lt.id)}
                    className={`${styles.tab} ${activeLoan === lt.id ? styles.activeTab : ''}`}
                  >
                    <span className={styles.tabIcon}>{lt.icon}</span>
                    <span>{lt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount slider */}
            <SliderField
              label="Loan Amount"
              displayValue={formatINR(amount)}
              value={amount}
              min={cfg.minAmt}
              max={cfg.maxAmt}
              step={Math.max(cfg.minAmt, 10000)}
              onChange={setAmount}
              minLabel={formatINR(cfg.minAmt)}
              maxLabel={formatINR(cfg.maxAmt)}
            />

            {/* Duration slider */}
            <SliderField
              label="Loan Duration"
              displayValue={`${years} yr${years > 1 ? 's' : ''}`}
              value={years}
              min={cfg.minYrs}
              max={cfg.maxYrs}
              step={1}
              onChange={setYears}
              minLabel={`${cfg.minYrs} yr`}
              maxLabel={`${cfg.maxYrs} yrs`}
            />
          </div>

          {/* ── RIGHT: Results card ── */}
          <div className={styles.resultsCard}>

            {/* Rate block */}
            <div className={styles.rateBlock}>
              <span className={styles.rateLabel}>Interest Rate (p.a.)</span>
              <span className={styles.rateValue}>{cfg.rate}%</span>
            </div>

            <div className={styles.separator} />

            {/* Calculations */}
            <div className={styles.calcSection}>
              <CalcRow label="Monthly EMI"    value={`₹${Math.round(emi).toLocaleString('en-IN')}`} />
              <CalcRow label="Total Interest" value={`₹${Math.round(totalInterest).toLocaleString('en-IN')}`} />
              <CalcRow label="Total Payment"  value={`₹${Math.round(totalPayment).toLocaleString('en-IN')}`} bold />
            </div>

            <div className={styles.separator} />

            {/* Documents */}
            <div className={styles.docsSection}>
              <p className={styles.docsTitle}>Documents Required</p>
              <ul className={styles.docsList}>
                {documents[activeLoan].map((doc) => (
                  <li key={doc} className={styles.docItem}>
                    <span className={styles.docCheck} aria-hidden="true">✓</span>
                    {doc}
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.separator} />

            {/* CTA buttons */}
            <div className={styles.cardActions}>
              <Link href="/loans" className={styles.detailsBtn}>Details</Link>
              <Link href="/login" className={styles.applyBtn}>
                Apply Now
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Sub-components ──────────────────────────────────────────── */
function SliderField({ label, displayValue, value, min, max, step, onChange, minLabel, maxLabel }) {
  const pct = sliderPct(value, min, max)
  return (
    <div className={styles.sliderField}>
      <div className={styles.sliderHeader}>
        <span className={styles.sliderLabel}>{label}</span>
        <span className={styles.sliderDisplay}>{displayValue}</span>
      </div>
      <div className={styles.sliderTrack}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={styles.slider}
          style={{ '--pct': pct }}
          aria-label={label}
        />
      </div>
      <div className={styles.sliderRange}>
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  )
}

function CalcRow({ label, value, bold }) {
  return (
    <div className={`${styles.calcRow} ${bold ? styles.calcRowBold : ''}`}>
      <span className={styles.calcLabel}>{label}</span>
      <span className={styles.calcValue}>{value}</span>
    </div>
  )
}
