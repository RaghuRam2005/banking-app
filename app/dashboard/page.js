// src/app/dashboard/page.js
import UserDashboard from '@/components/user/UserDashboard'

export const metadata = {
  title: 'Dashboard — Nova Bank',
}

export default function Dashboard() {
  return <UserDashboard />
}