import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowRight, Bell, BookOpen, Box, CalendarDays, Check, ChevronDown, CircleHelp,
  Clock3, Heart, LayoutDashboard, MapPin, Menu, MessageCircle, Package,
  Plus, Search, ShieldCheck, Sparkles, Star, TrendingUp, Users, X
} from 'lucide-react'
import './styles.css'
import { listItems } from './api'

const items = [
  { title: 'Sony WH-1000XM5', category: 'Electronics', price: '₹120/day', owner: 'Aarav Mehta', rating: '4.9', distance: '1.2 km', image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80', color: 'blue' },
  { title: 'Canon EOS 1500D', category: 'Photography', price: '₹450/day', owner: 'Diya Shah', rating: '4.8', distance: '2.4 km', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80', color: 'orange' },
  { title: 'Camping Tent for 4', category: 'Sports & Outdoors', price: '₹280/day', owner: 'Rohan Kapoor', rating: '5.0', distance: '3.1 km', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80', color: 'green' },
  { title: 'Cordless Drill Set', category: 'Tools & Equipment', price: '₹180/day', owner: 'Nisha Iyer', rating: '4.7', distance: '4.8 km', image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80', color: 'purple' },
]

const categories = [
  ['Electronics', '◉', '2,480 items'], ['Books & Study', '▤', '1,820 items'],
  ['Sports & Outdoors', '♧', '960 items'], ['Home & Kitchen', '⌂', '1,240 items'],
  ['Tools & Equipment', '⌁', '680 items'], ['Photography', '◎', '420 items'],
]

function App() {
  const [active, setActive] = useState('Explore')
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [saved, setSaved] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [toast, setToast] = useState('')
  const [apiItems, setApiItems] = useState(null)
  const [apiError, setApiError] = useState('')
  const [location, setLocation] = useState(null)
  const [radius, setRadius] = useState('10')
  const [customRadius, setCustomRadius] = useState('15')
  const [locationMessage, setLocationMessage] = useState('')

  useEffect(() => {
    const params = { radius: radius === 'custom' ? customRadius : radius, sort: location ? 'distance' : 'recent' }
    if (location) Object.assign(params, location)
    listItems(params)
      .then(({ data }) => setApiItems(data.map(item => ({ ...item, price: `₹${item.pricePerDay}/day`, distance: item.distanceKm === undefined ? 'Nearby' : `${item.distanceKm.toFixed(1)} km`, owner: item.ownerName, rating: item.rating.toFixed(1), image: imageForCategory(item.category) }))))
      .catch(error => setApiError(error.message))
  }, [location, radius, customRadius])

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Location is not supported by this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude })
        setLocationMessage('Showing available items near your location.')
      },
      () => setLocationMessage('Location permission was not granted. Choose a city or browse all items.')
    )
  }

  const showToast = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }
  const availableItems = apiItems || items
  const filtered = availableItems.filter(item => `${item.title} ${item.category}`.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#" onClick={() => setActive('Explore')}><span className="brand-mark">b</span><span>borrow<span className="brand-accent">hub</span></span></a>
        <nav className={menuOpen ? 'nav open' : 'nav'}>
          {['Explore', 'How it works', 'My dashboard'].map(label => <button key={label} className={active === label ? 'nav-link active' : 'nav-link'} onClick={() => { setActive(label); setMenuOpen(false) }}>{label}</button>)}
        </nav>
        <div className="top-actions">
          <button className="icon-btn notification" aria-label="Notifications" onClick={() => showToast('You have 3 new notifications')}><Bell size={19}/><span /></button>
          <button className="avatar" onClick={() => setActive('My dashboard')}>AM</button>
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X/> : <Menu/>}</button>
        </div>
      </header>

      <main>
        {active === 'Explore' && <Explore search={search} setSearch={setSearch} filtered={filtered} saved={saved} setSaved={setSaved} setSelectedItem={setSelectedItem} showToast={showToast} apiError={apiError} requestLocation={requestLocation} location={location} radius={radius} setRadius={setRadius} customRadius={customRadius} setCustomRadius={setCustomRadius} locationMessage={locationMessage} />}
        {active === 'How it works' && <HowItWorks />}
        {active === 'My dashboard' && <Dashboard setSelectedItem={setSelectedItem} showToast={showToast} />}
      </main>
      {selectedItem && <ItemModal item={selectedItem} close={() => setSelectedItem(null)} showToast={showToast} />}
      {toast && <div className="toast"><Check size={17}/>{toast}</div>}
    </div>
  )
}

function imageForCategory(category) {
  if (category.includes('Photography')) return items[1].image
  if (category.includes('Sports')) return items[2].image
  if (category.includes('Tools')) return items[3].image
  return items[0].image
}

function Explore({ search, setSearch, filtered, saved, setSaved, setSelectedItem, showToast, apiError, requestLocation, location, radius, setRadius, customRadius, setCustomRadius, locationMessage }) {
  return <div>
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow"><span className="pulse-dot"/> COMMUNITY POWERED</div>
        <h1>Borrow what you need.<br/><em>Share what you have.</em></h1>
        <p>Access thousands of useful things from people around you. Save money, reduce waste, and build a more connected community.</p>
        <div className="hero-search">
          <Search size={20}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="What are you looking for?" /><button onClick={() => document.getElementById('items').scrollIntoView({ behavior: 'smooth' })}>Search</button>
        </div>
        <div className="hero-note"><ShieldCheck size={16}/> <span>Verified members</span><span className="divider"/> <MapPin size={16}/> <span>Available near you</span></div>
      </div>
      <div className="hero-art">
        <div className="art-card art-card-back"><span>♧</span></div><div className="art-card art-card-main"><Package size={75}/><strong>Share more.</strong><small>Own less.</small></div>
        <div className="float-card"><div className="mini-avatars"><i>SK</i><i>RM</i><i>+</i></div><span><b>12.4k</b><small>things shared</small></span></div>
      </div>
    </section>
    <section className="section" id="items">
      <div className="section-heading"><div><p className="eyebrow">DISCOVER NEARBY</p><h2>Find something useful</h2></div><button className="text-button" onClick={() => showToast('Filters are ready for the next step')}>View all items <ArrowRight size={17}/></button></div>
      <div className="category-row">{categories.map(([name, icon, count]) => <button className="category" key={name} onClick={() => setSearch(name)}><span className="category-icon">{icon}</span><b>{name}</b><small>{count}</small></button>)}</div>
      <div className="location-controls">
        <button className="button primary" onClick={requestLocation}><MapPin size={16}/> {location ? 'Location enabled' : 'Use my location'}</button>
        <label>Search radius <select value={radius} onChange={event => setRadius(event.target.value)}><option value="2">2 km</option><option value="5">5 km</option><option value="10">10 km</option><option value="custom">Custom</option></select></label>
        {radius === 'custom' && <label><input className="radius-input" type="number" min="1" max="100" value={customRadius} onChange={event => setCustomRadius(event.target.value)} /> km</label>}
        {locationMessage && <span>{locationMessage}</span>}
      </div>
      {apiError && <div className="api-notice"><CircleHelp size={16}/> Live catalog unavailable: {apiError}. Showing the demo catalog.</div>}
      <div className="item-grid">{filtered.map(item => <ItemCard key={item.id || item.title} item={item} saved={saved.includes(item.title)} toggleSave={() => setSaved(saved.includes(item.title) ? saved.filter(s => s !== item.title) : [...saved, item.title])} open={() => setSelectedItem(item)} />)}</div>
      {!filtered.length && <div className="empty"><Search size={28}/><h3>No items found</h3><p>Try a different search term or category.</p></div>}
    </section>
    <section className="stats-strip"><div><strong>8,420+</strong><span>Items available</span></div><div><strong>12,800+</strong><span>Active members</span></div><div><strong>34,560</strong><span>Successful borrows</span></div><div><strong>4.9/5</strong><span>Community rating</span></div></section>
  </div>
}

function ItemCard({ item, saved, toggleSave, open }) {
  return <article className="item-card"><div className="item-image"><img src={item.image} alt={item.title}/><button className={saved ? 'save saved' : 'save'} onClick={toggleSave} aria-label="Save item"><Heart size={18} fill={saved ? 'currentColor' : 'none'}/></button><span className="distance"><MapPin size={13}/>{item.distance}</span></div><div className="item-info"><div className="item-category">{item.category}</div><h3>{item.title}</h3><div className="owner"><span className="owner-avatar">{item.owner.split(' ').map(n => n[0]).join('')}</span><span>{item.owner}</span><span className="rating"><Star size={13} fill="currentColor"/>{item.rating}</span></div><div className="item-footer"><b>{item.price}</b><button onClick={open}>View details <ArrowRight size={14}/></button></div></div></article>
}

function HowItWorks() {
  return <section className="page-section"><div className="center-heading"><p className="eyebrow">SIMPLE BY DESIGN</p><h1>Borrowing made easy</h1><p>From finding the right item to returning it safely, Borrow Hub keeps every step clear and community-first.</p></div><div className="steps">{[['01', Search, 'Find what you need', 'Browse items shared by people nearby and filter by category, price, or distance.'], ['02', CalendarDays, 'Request to borrow', 'Choose your dates, send a quick request, and chat with the owner.'], ['03', ShieldCheck, 'Borrow with confidence', 'Meet safely, verify the handover, and enjoy your item. Return it when done.']].map(([number, Icon, title, copy]) => <div className="step" key={number}><span className="step-number">{number}</span><div className="step-icon"><Icon size={28}/></div><h2>{title}</h2><p>{copy}</p></div>)}</div><div className="trust-banner"><div className="trust-icon"><Users/></div><div><h2>Built on trust, powered by community</h2><p>Every member is verified and every exchange is protected by our community guidelines.</p></div><button className="button secondary">Learn about safety <ArrowRight size={16}/></button></div></section>
}

function Dashboard({ setSelectedItem, showToast }) {
  return <section className="dashboard"><aside className="side-nav"><div className="dash-user"><span className="avatar large">AM</span><div><b>Arjun Mehta</b><small>Member since 2024</small></div></div>{[['Overview', LayoutDashboard], ['My borrowings', BookOpen], ['My listings', Box], ['Messages', MessageCircle], ['Saved items', Heart]].map(([label, Icon], i) => <button className={i === 0 ? 'side-link selected' : 'side-link'} key={label}><Icon size={18}/>{label}{label === 'Messages' && <span className="side-badge">2</span>}</button>)}<button className="side-link"><CircleHelp size={18}/>Help center</button></aside><div className="dash-content"><div className="dash-header"><div><p className="eyebrow">YOUR SPACE</p><h1>Good morning, Arjun <span>✦</span></h1><p>Here's what's happening with your borrowing journey.</p></div><button className="button primary" onClick={() => showToast('Listing flow opened')}><Plus size={18}/> List an item</button></div><div className="metric-grid">{[['Active borrowings', '2', Clock3, '1 due this week'], ['Items listed', '5', Package, '+2 this month'], ['Trust score', '4.9', ShieldCheck, 'Excellent'], ['Saved items', '12', Heart, '3 new nearby']].map(([title, value, Icon, note]) => <div className="metric" key={title}><div className="metric-top"><span>{title}</span><Icon size={17}/></div><strong>{value}</strong><small>{note}</small></div>)}</div><div className="dash-columns"><div className="panel"><div className="panel-heading"><h2>Current borrowings</h2><button className="text-button">See all <ArrowRight size={15}/></button></div><div className="borrowing"><img src={items[0].image} alt="Headphones"/><div><b>{items[0].title}</b><small><CalendarDays size={13}/> Nov 02 — Nov 05, 2026</small></div><span className="status active">Active</span></div><div className="borrowing"><img src={items[2].image} alt="Tent"/><div><b>{items[2].title}</b><small><CalendarDays size={13}/> Nov 18 — Nov 21, 2026</small></div><span className="status upcoming">Upcoming</span></div></div><div className="panel recommendation"><div className="panel-heading"><h2><Sparkles size={18}/> Recommended for you</h2></div><div className="recommendation-card"><img src={items[1].image} alt="Camera"/><div><b>Canon EOS 1500D</b><small>Popular in your area</small><button onClick={() => setSelectedItem(items[1])}>View item <ArrowRight size={14}/></button></div></div></div></div></div></section>
}

function ItemModal({ item, close, showToast }) {
  const mapUrl = item.location?.lat === undefined ? null : `https://www.openstreetmap.org/?mlat=${item.location.lat}&mlon=${item.location.lng}#map=14/${item.location.lat}/${item.location.lng}`
  return <div className="modal-backdrop" onClick={close}><div className="modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={close}><X size={20}/></button><img className="modal-image" src={item.image} alt={item.title}/><div className="modal-body"><div className="item-category">{item.category}</div><h2>{item.title}</h2><div className="owner modal-owner"><span className="owner-avatar">{item.owner.split(' ').map(n => n[0]).join('')}</span><span>Listed by <b>{item.owner}</b></span><span className="rating"><Star size={14} fill="currentColor"/>{item.rating}</span></div><p className="modal-copy">Well maintained and ready to borrow. Pickup details are shared after your request is approved.</p><div className="modal-location"><MapPin size={15}/><span>Approximate area: {item.location?.area}, {item.location?.city}</span>{mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer">Open map</a>}</div><div className="modal-price"><span>Borrowing rate</span><strong>{item.price}</strong></div><button className="button primary full" onClick={() => { close(); showToast('Borrow request sent to ' + item.owner) }}>Request to borrow <ArrowRight size={17}/></button></div></div></div>
}

createRoot(document.getElementById('root')).render(<App />)
