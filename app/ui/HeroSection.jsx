import styles from '@/app/ui/HeroSection.module.css'

const stats = [
  { value: '2M+', label: 'Customers' },
  { value: '₹80B+', label: 'Assets Managed' },
  { value: '25+', label: 'Years of Trust' },
  { value: '4.9★', label: 'Customer Rating' },
]

const words = [
  { text: 'Banking', gold: false, break: false },
  { text: 'Elevated,', gold: false, break: true },
  { text: 'Life', gold: true, break: false },
  { text: 'Simplified.', gold: false, break: false },
]

export default function HeroSection() {
  return (
    <section className={styles.hero} id="hero">
      {/* Decorative background layers */}
      <div className={styles.bg} aria-hidden="true">
        <div className={styles.orb1} />
        <div className={styles.orb2} />
        <div className={styles.orb3} />
        <div className={styles.gridPattern} />
        <div className={styles.vignette} />
      </div>

      {/* Gold rule top */}
      <div className={styles.ruleTop} aria-hidden="true" />

      {/* Main content */}
      <div className={styles.content}>
        <div className={styles.badge}>
          <span className={styles.badgePulse} aria-hidden="true" />
          <span className={styles.badgeDot} aria-hidden="true" />
          <span>Trusted by millions across India</span>
        </div>

        <h1 className={styles.headline}>
          {words.map((w, i) => (
            <span key={i}>
              <span
                className={`${styles.word} ${w.gold ? styles.goldWord : ''}`}
                style={{ animationDelay: `${0.1 + i * 0.18}s` }}
              >
                {w.text}
              </span>
              {w.break ? <br /> : ' '}
            </span>
          ))}
        </h1>

        <p className={styles.subtitle}>
          Nova Bank combines decades of financial expertise with cutting-edge technology
          to deliver a banking experience that truly serves you — from everyday savings
          to wealth management.
        </p>

        <div className={styles.cta}>
          <a href="#accounts" className={styles.ctaPrimary}>
            Explore Accounts
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </a>
          <a href="#loans" className={styles.ctaSecondary}>View Loan Options</a>
        </div>
      </div>

      {/* Stats bar */}
      <div className={styles.statsBar}>
        <div className={styles.statsInner}>
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={styles.statItem}
              style={{ animationDelay: `${0.85 + i * 0.1}s` }}
            >
              <span className={styles.statValue}>{s.value}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className={styles.scrollIndicator} aria-hidden="true">
        <div className={styles.scrollMouse}>
          <div className={styles.scrollWheel} />
        </div>
        <span className={styles.scrollText}>Scroll to explore</span>
      </div>
    </section>
  )
}
