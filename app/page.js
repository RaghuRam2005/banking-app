import Navbar from '@/app/ui/Navbar'
import HeroSection from '@/app/ui/HeroSection'
import AccountTypesSection from '@/app/ui/AccountTypesSection'
import LoanSection from '@/app/ui/LoanSection'

export const metadata = {
  title: 'Nova Bank — Banking Elevated, Life Simplified',
  description:
    'Nova Bank combines decades of financial expertise with cutting-edge technology. Explore savings accounts, fixed deposits, and loan solutions tailored for you.',
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