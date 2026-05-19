import Navbar from "@/app/ui/Navbar"
import HeroSection from '@/app/ui/HeroSection'
import AccountTypesSection from '@/app/ui/AccountTypesSection'
import LoanSection from '@/app/ui/LoanSection'

export const metadata = {
  title: 'Aurum Bank — Banking Elevated, Life Simplified',
  description:
    'Aurum Bank combines decades of financial expertise with cutting-edge technology. Explore savings accounts, fixed deposits, and loan solutions tailored for you.',
}

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <AccountTypesSection />
        <LoanSection />
      </main>
    </>
  )
}
