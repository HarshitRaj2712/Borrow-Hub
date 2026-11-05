import { ThemeProvider } from '../components/ThemeContext.jsx'
import HomePage from './HomePage.jsx'
import AuthPage from './AuthPage.jsx'
import VerificationPage from './VerificationPage.jsx'
import ResetPasswordPage from './ResetPasswordPage.jsx'
import React from 'react'

export default function App() {
  const token = new URLSearchParams(window.location.search).get('token')
  const path = window.location.pathname
  return <ThemeProvider>
    {path === '/verify-email' && token ? <VerificationPage token={token} />
      : path === '/reset-password' && token ? <ResetPasswordPage token={token} />
      : path === '/signin' ? <AuthPage mode="login" />
      : path === '/signup' ? <AuthPage mode="register" />
      : <HomePage />}
  </ThemeProvider>
}