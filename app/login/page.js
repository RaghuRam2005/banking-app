// src/app/login/page.js
import LoginPage from '@/components/auth/LoginPage'

export const metadata = {
  title: 'Sign In — Nova Bank',
  description: 'Sign into your Nova Bank account.',
}

export default function Login() {
  return <LoginPage />
}