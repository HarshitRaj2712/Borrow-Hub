import React, { useEffect, useState } from 'react'
import {
  ArrowRight, BookOpen, CalendarDays, Check, CircleHelp, Clock3, Heart,
  LayoutDashboard, MapPin, Moon, Package, Search, ShieldCheck, Star, Sun, User, Users, X
} from 'lucide-react'
import '../styles.css'
import '../feature-styles.css'
import {
  createBorrowRequest, createItem, getAvailability, getProfile, listBookings, listItems, listMyItems, logoutUser, uploadItemImage,
  loginUser, registerUser, resendVerification, resetPassword, verifyEmail, forgotPassword, updateBookingStatus, updateProfile, recordItemActivity
} from '../api'
import Navbar from '../components/Navbar.jsx'
import { useTheme } from '../components/ThemeContext.jsx'
import ItemStatusBadge from '../components/ItemStatusBadge.jsx'
function AuthPage({ mode: initialMode }) {
  const [mode, setMode] = useState(initialMode)
  const { theme, toggleTheme } = useTheme()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'borrower', gender: 'prefer_not_to_say' })
  const [profileImage, setProfileImage] = useState(null)
  const [profilePreview, setProfilePreview] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (!profileImage) {
      setProfilePreview('')
      return undefined
    }
    const url = URL.createObjectURL(profileImage)
    setProfilePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [profileImage])
  const submit = async event => {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      if (mode === 'forgot') {
        const result = await forgotPassword(form.email)
        setMessage(result.data.message)
      } else {
        const result = mode === 'login' ? await loginUser({ email: form.email, password: form.password }) : await registerUser(form, profileImage)
        localStorage.setItem('borrow-hub-session', JSON.stringify(result.data))
        window.location.href = '/'
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }
  const updateMode = nextMode => {
    setMode(nextMode)
    setError('')
    setMessage('')
  }
  const isLogin = mode === 'login'
  const isForgot = mode === 'forgot'
  return <div className="auth-shell"><header className="topbar auth-navbar"><a className="brand" href="/"><span className="brand-mark">b</span><span>borrow<span className="brand-accent">hub</span></span></a><form className="navbar-search" onSubmit={event => { event.preventDefault(); window.location.href = '/' }} role="search"><Search size={18} aria-hidden="true"/><input placeholder="Search items, categories, or locations" aria-label="Search items"/></form><div className="top-actions"><button className="theme-toggle" aria-label="Toggle theme" onClick={toggleTheme}>{theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}</button><a className="auth-home-link" href="/">Home</a></div></header><main className="auth-page"><div className="auth-page-card"><div className="auth-page-heading"><p className="eyebrow">BORROW HUB ACCOUNT</p><h1>{isForgot ? 'Reset your password' : isLogin ? 'Welcome back' : 'Create your account'}</h1><p>{isForgot ? 'Enter your email and we will send a secure reset link.' : isLogin ? 'Sign in to continue borrowing and sharing.' : 'Join your local community of borrowers and lenders.'}</p></div><form className="auth-page-form" onSubmit={submit}>{mode === 'register' && <><label className="profile-image-picker"><span className="profile-image-preview">{profilePreview ? <img src={profilePreview} alt="Profile preview"/> : <User size={30}/>}</span><span>{profileImage ? profileImage.name : 'Add profile photo'}<small>Optional · JPEG, PNG, or WebP up to 5 MB</small></span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setProfileImage(event.target.files?.[0] || null)}/></label><label>Name<input required minLength="2" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label>Phone<input required minLength="7" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></label><div className="auth-page-grid"><label>Account type<select value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}><option value="borrower">Borrower</option><option value="lender">Lender</option></select></label><label>Gender<select value={form.gender} onChange={event => setForm({ ...form, gender: event.target.value })}><option value="prefer_not_to_say">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="non_binary">Non-binary</option></select></label></div></>}<label>Email<input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label>{!isForgot && <label>Password<input required minLength="8" type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></label>}{error && <div className="form-error">{error}</div>}{message && <div className="auth-page-message">{message}</div>}<button className="button primary auth-page-submit" disabled={loading}>{loading ? 'Please wait…' : isForgot ? 'Send reset link' : isLogin ? 'Sign in' : 'Create account'}</button></form>{isLogin && <button className="text-button auth-page-link" onClick={() => updateMode('forgot')}>Forgot password?</button>}{isForgot ? <p className="auth-page-switch">Remembered your password? <button onClick={() => updateMode('login')}>Sign in</button></p> : <p className="auth-page-switch">{isLogin ? 'Don’t have an account?' : 'Already have an account?'} <button onClick={() => updateMode(isLogin ? 'register' : 'login')}>{isLogin ? 'Create one' : 'Sign in'}</button></p>}<a className="auth-page-home" href="/">← Back to home</a></div></main></div>
}


export default AuthPage
