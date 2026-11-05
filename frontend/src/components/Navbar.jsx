import { Moon, Search, Sun } from 'lucide-react'
import { useTheme } from './ThemeContext.jsx'
import React from 'react'
export default function Navbar({ session, onDashboard, search = '', setSearch, auth = true }) {
  const { theme, toggleTheme } = useTheme()
  const submitSearch = event => {
    event.preventDefault()
    document.getElementById('items')?.scrollIntoView({ behavior: 'smooth' })
  }

  return <header className="topbar">
    <a className="brand" href="/" onClick={event => {
      if (window.location.pathname === '/') {
        event.preventDefault()
        onDashboard?.('Explore')
      }
    }}><span className="brand-mark">b</span><span>borrow<span className="brand-accent">hub</span></span></a>
    <form className="navbar-search" onSubmit={submitSearch} role="search">
      <Search size={18} aria-hidden="true"/>
      <input value={search} onChange={event => setSearch?.(event.target.value)} placeholder="Search items, categories, or locations" aria-label="Search items"/>
    </form>
    <div className="top-actions">
      <button className="theme-toggle" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} onClick={toggleTheme}>{theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}</button>
      {session ? <button className="avatar" onClick={() => onDashboard?.('My dashboard')}>{session.user?.name?.split(' ').map(value => value[0]).join('').slice(0, 2).toUpperCase() || 'BH'}</button> : auth && <><a className="button secondary top-login" href="/signin">Sign in</a><a className="button primary top-signup" href="/signup">Sign up</a></>}
    </div>
  </header>
}
