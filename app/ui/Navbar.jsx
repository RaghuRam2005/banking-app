'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import styles from '@/app/ui/Navbar.module.css'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}>
      <Link href="/" className={styles.logo}>
        <img
          src="/favicon.svg"
          alt="Aurum Bank logo"
          width={38}
          height={38}
          className={styles.logoMark}
        />
        <div className={styles.logoText}>
          <span className={styles.logoName}>Aurum</span>
          <span className={styles.logoSub}>Bank</span>
        </div>
      </Link>

      <Link href="/login" className={styles.loginBtn}>
        <span>Login</span>
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <polyline points="10 17 15 12 10 7" />
          <line x1="15" y1="12" x2="3" y2="12" />
        </svg>
      </Link>
    </nav>
  )
}