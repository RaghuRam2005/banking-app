'use client'
import Link from 'next/link'
import { useScrollAnimation } from "@/app/ui/useScrollAnimation"
import styles from '@/app/ui/AccountTypesSection.module.css'

const accounts = [
  {
    id: 'savings',
    name: 'Savings Account',
    desc: 'Earn daily interest and grow your balance effortlessly',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    id: 'current',
    name: 'Current Account',
    desc: 'Unlimited transactions and overdraft facility for your business',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: 'fd',
    name: 'Fixed Deposit',
    desc: 'Lock in your funds for guaranteed higher returns up to 7.5% p.a.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    id: 'wealth',
    name: 'Premium Wealth Account',
    desc: 'Exclusive banking privileges designed for high net worth individuals',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
]

export default function AccountTypesSection() {
  const [sectionRef, sectionVisible] = useScrollAnimation({ threshold: 0.1 })
  const [cardRef, cardVisible] = useScrollAnimation({ threshold: 0.15, rootMargin: '0px 0px -40px 0px' })

  return (
    <section id="accounts" className={styles.section} ref={sectionRef}>
      <div className={styles.container}>
        {/* Heading */}
        <div className={`${styles.header} ${sectionVisible ? styles.visible : ''}`}>
          <div className={styles.badge}>Account Types</div>
          <h2 className={styles.title}>Find Your Perfect Account</h2>
          <p className={styles.desc}>
            Whether you are saving for tomorrow or running a thriving business, Aurum Bank has
            an account built for your life.
          </p>
        </div>

        {/* Elevated card */}
        <div
          className={`${styles.card} ${cardVisible ? styles.cardVisible : ''}`}
          ref={cardRef}
        >
          {accounts.map((account, i) => (
            <Link
              href="/login"
              key={account.id}
              className={styles.row}
              style={{ transitionDelay: cardVisible ? `${i * 0.07}s` : '0s' }}
              aria-label={`Open ${account.name}`}
            >
              <div className={styles.rowLeft}>
                <div className={styles.iconWrap}>{account.icon}</div>
                <div className={styles.rowInfo}>
                  <span className={styles.rowName}>{account.name}</span>
                  <span className={styles.rowDesc}>{account.desc}</span>
                </div>
              </div>
              <div className={styles.arrowWrap} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
              {i < accounts.length - 1 && <div className={styles.divider} />}
            </Link>
          ))}
        </div>

        {/* Small footnote */}
        <p className={`${styles.footnote} ${sectionVisible ? styles.visible : ''}`}>
          All accounts are insured under DICGC up to ₹5 Lakhs.
        </p>
      </div>
    </section>
  )
}
