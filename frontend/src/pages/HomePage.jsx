import React, { useEffect, useState } from 'react'
import {
  ArrowRight, BookOpen, CalendarDays, Check, CircleHelp, Clock3, Heart,
  LayoutDashboard, MapPin, Moon, Package, Search, ShieldCheck, Star, Sun, User, Users, X
} from 'lucide-react'
import '../styles.css'
import '../feature-styles.css'
import {
  createBorrowRequest, createItem, deleteItem, getAvailability, getProfile, listBookings, listItems, listMyItems, logoutUser, updateItem, updateItemAvailability, uploadItemImage,
  loginUser, registerUser, resendVerification, resetPassword, verifyEmail, forgotPassword, updateBookingStatus, updateProfile, recordItemActivity
} from '../api'
import Navbar from '../components/Navbar.jsx'
import { useTheme } from '../components/ThemeContext.jsx'
import ItemStatusBadge from '../components/ItemStatusBadge.jsx'
const demoItems = [
  { title: 'Sony WH-1000XM5', category: 'Electronics', price: '₹120/day', owner: 'Aarav Mehta', rating: '4.9', distance: '1.2 km', image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80' },
  { title: 'Canon EOS 1500D', category: 'Photography', price: '₹450/day', owner: 'Diya Shah', rating: '4.8', distance: '2.4 km', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80' },
  { title: 'Camping Tent for 4', category: 'Sports & Outdoors', price: '₹280/day', owner: 'Rohan Kapoor', rating: '5.0', distance: '3.1 km', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80' },
  { title: 'Cordless Drill Set', category: 'Tools & Equipment', price: '₹180/day', owner: 'Nisha Iyer', rating: '4.7', distance: '4.8 km', image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80' }
]

const categories = [
  ['Electronics', '◉'], ['Books and Study Materials', '▤'],
  ['Sports Equipment', '♧'], ['Home Appliances', '⌂'],
  ['Tools and Equipment', '⌁'], ['Photography Equipment', '◎']
]

function initials(name = '') {
  return name.split(' ').map(value => value[0]).join('').slice(0, 2).toUpperCase() || 'BH'
}

function roleLabel(role) {
  return role === 'lender' ? 'Lender' : role === 'borrower' ? 'Borrower' : role === 'admin' ? 'Administrator' : 'Member'
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })
}

function accountAge(value) {
  if (!value) return 'New member'
  const months = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24 * 30)))
  return months ? `Member for ${months} month${months === 1 ? '' : 's'}` : 'New member'
}

function UserIcon() {
  return <User size={17} />
}


function MainApp() {
  const [active, setActive] = useState('Explore')
  const [search, setSearch] = useState('')
  const [saved, setSaved] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [apiItems, setApiItems] = useState(null)
  const [apiError, setApiError] = useState('')
  const [itemsLoading, setItemsLoading] = useState(true)
  const [location, setLocation] = useState(null)
  const [radius, setRadius] = useState('10')
  const [customRadius, setCustomRadius] = useState('15')
  const [locationMessage, setLocationMessage] = useState('')
  const [session, setSession] = useState(() => JSON.parse(localStorage.getItem('borrow-hub-session') || 'null'))

  useEffect(() => {
    const params = { radius: radius === 'custom' ? customRadius : radius, sort: location ? 'distance' : 'recent' }
    if (location) Object.assign(params, location)
    let activeRequest = true
    setItemsLoading(true)
    setApiError('')
    listItems(params)
      .then(({ data }) => { if (activeRequest) setApiItems(data.map(formatItem)) })
      .catch(error => { if (activeRequest) setApiError(error.message) })
      .finally(() => { if (activeRequest) setItemsLoading(false) })
    return () => { activeRequest = false }
  }, [location, radius, customRadius])

  const showToast = message => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }
  const signIn = data => {
    localStorage.setItem('borrow-hub-session', JSON.stringify(data))
    setSession(data)
    setAuthOpen(false)
    showToast(data.verificationEmailSent === false ? data.verificationMessage : `Welcome, ${data.user.name}`)
  }
  const signOut = async () => {
    if (session?.token) {
      try { await logoutUser(session.token) } catch (error) { showToast(error.message) }
    }
    localStorage.removeItem('borrow-hub-session')
    setSession(null)
    setActive('Explore')
    showToast('You have been signed out')
  }
  const requestLocation = () => {
    if (!navigator.geolocation) return setLocationMessage('Location is not supported by this browser.')
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude })
        setLocationMessage('Showing available items near your location.')
      },
      () => setLocationMessage('Location permission was not granted. Showing all items.')
    )
  }
  const availableItems = apiItems || []
  const filtered = availableItems.filter(item => `${item.title} ${item.category}`.toLowerCase().includes(search.toLowerCase()))
  const updateSessionUser = user => {
    setSession(current => {
      if (!current) return current
      const updated = { ...current, user }
      localStorage.setItem('borrow-hub-session', JSON.stringify(updated))
      return updated
    })
  }
  return <div className="app">
    <Navbar session={session} search={search} setSearch={setSearch} onDashboard={value => setActive(value)} />
    <main>
      {active === 'Explore' && <Explore search={search} setSearch={setSearch} filtered={filtered} saved={saved} setSaved={setSaved} setSelectedItem={setSelectedItem} showToast={showToast} apiError={apiError} itemsLoading={itemsLoading} requestLocation={requestLocation} location={location} radius={radius} setRadius={setRadius} customRadius={customRadius} setCustomRadius={setCustomRadius} locationMessage={locationMessage} />}
      {active === 'How it works' && <HowItWorks />}
      {active === 'My dashboard' && <Dashboard session={session} setAuthOpen={() => { window.location.href = '/signin' }} showToast={showToast} signOut={signOut} onProfileUpdated={updateSessionUser} />}
    </main>
    {selectedItem && <ItemModal item={selectedItem} session={session} close={() => setSelectedItem(null)} showToast={showToast} openAuth={() => { window.location.href = '/signin' }} />}
    {authOpen && <AuthModal mode={authMode} setMode={setAuthMode} close={() => setAuthOpen(false)} onSuccess={signIn} />}
    {toast && <div className="toast"><Check size={17}/>{toast}</div>}
  </div>
}

function formatItem(item) {
  return { ...item, price: item.pricePerDay ? `₹${item.pricePerDay}/day` : 'Free', distance: item.distanceKm === undefined ? 'Nearby' : `${item.distanceKm.toFixed(1)} km`, owner: item.ownerName, rating: Number(item.rating || 0).toFixed(1), image: item.images?.[0]?.url || imageForCategory(item.category) }
}

function imageForCategory(category) {
  if (category.includes('Photography')) return demoItems[1].image
  if (category.includes('Sports')) return demoItems[2].image
  if (category.includes('Tools')) return demoItems[3].image
  return demoItems[0].image
}

function Explore({ search, setSearch, filtered, saved, setSaved, setSelectedItem, showToast, apiError, itemsLoading, requestLocation, location, radius, setRadius, customRadius, setCustomRadius, locationMessage }) {
  return <div>
    <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="pulse-dot"/> COMMUNITY POWERED</div><h1>Borrow what you need.<br/><em>Share what you have.</em></h1><p>Access useful things from people around you. Save money, reduce waste, and build a more connected community.</p><div className="hero-search"><Search size={20}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="What are you looking for?" /><button onClick={() => document.getElementById('items').scrollIntoView({ behavior: 'smooth' })}>Search</button></div><div className="hero-note"><ShieldCheck size={16}/> <span>Verified members</span><span className="divider"/> <MapPin size={16}/> <span>Available near you</span></div></div><div className="hero-art"><div className="art-card art-card-back"><span>♧</span></div><div className="art-card art-card-main"><Package size={75}/><strong>Share more.</strong><small>Own less.</small></div></div></section>
    <section className="section" id="items"><div className="section-heading"><div><p className="eyebrow">DISCOVER NEARBY</p><h2>Find something useful</h2></div><span className="result-count">{itemsLoading ? 'Loading…' : `${filtered.length} available`}</span></div><div className="category-row">{categories.map(([name, icon]) => <button className="category" key={name} onClick={() => setSearch(name)}><span className="category-icon">{icon}</span><b>{name}</b><small>Browse category</small></button>)}</div><div className="location-controls"><button className="button primary" onClick={requestLocation}><MapPin size={16}/> {location ? 'Location enabled' : 'Use my location'}</button><label>Search radius <select value={radius} onChange={event => setRadius(event.target.value)}><option value="2">2 km</option><option value="5">5 km</option><option value="10">10 km</option><option value="custom">Custom</option></select></label>{radius === 'custom' && <label><input className="radius-input" type="number" min="1" max="100" value={customRadius} onChange={event => setCustomRadius(event.target.value)} /> km</label>}{locationMessage && <span>{locationMessage}</span>}</div>{apiError && <div className="api-notice"><CircleHelp size={16}/> Unable to load the live catalog: {apiError}</div>}{itemsLoading && <div className="empty loading-state"><div className="loading-spinner"/><p>Loading available items…</p></div>}{!itemsLoading && !apiError && !filtered.length && <div className="empty"><Search size={28}/><h3>{search ? 'No items found' : 'No items listed yet'}</h3><p>{search ? 'Try a different search term or category.' : 'Be the first to list an item in your community.'}</p></div>}<div className="item-grid">{filtered.map(item => <ItemCard key={item.id} item={item} saved={saved.includes(item.title)} toggleSave={() => setSaved(saved.includes(item.title) ? saved.filter(value => value !== item.title) : [...saved, item.title])} open={() => setSelectedItem(item)} />)}</div></section><section className="stats-strip"><div><strong>{filtered.length}</strong><span>Items available</span></div><div><strong>Community</strong><span>Local sharing</span></div><div><strong>Secure</strong><span>Protected requests</span></div><div><strong>Nearby</strong><span>Discover locally</span></div></section>
  </div>
}

function ItemCard({ item, saved, toggleSave, open }) {
  return <article className="item-card"><div className="item-image"><img src={item.image} alt={item.title}/><button className={saved ? 'save saved' : 'save'} onClick={toggleSave} aria-label="Save item"><Heart size={18} fill={saved ? 'currentColor' : 'none'}/></button><span className="distance"><MapPin size={13}/>{item.distance}</span></div><div className="item-info"><div className="item-category">{item.category}</div><h3>{item.title}</h3><div className="item-meta"><span>{item.condition || 'Condition not specified'}</span><ItemStatusBadge status={item.status} available={item.available}/></div><div className="owner"><span className="owner-avatar">{initials(item.owner)}</span><span>{item.owner}</span><span className="rating"><Star size={13} fill="currentColor"/>{item.rating}</span></div><div className="item-footer"><b>{item.price}</b><button onClick={open}>View details <ArrowRight size={14}/></button></div></div></article>
}

function ItemModal({ item, session, close, showToast, openAuth }) {
  const today = new Date().toISOString().slice(0, 10)
  const [dates, setDates] = useState({ startDate: '', endDate: '' })
  const [availability, setAvailability] = useState(null)
  const [error, setError] = useState('')
  const [verificationOpen, setVerificationOpen] = useState(false)
  const [sendingVerification, setSendingVerification] = useState(false)
  useEffect(() => {
    if (!item.id) return
    getAvailability(item.id).then(({ data }) => setAvailability(data)).catch(() => {})
    if (session?.token) recordItemActivity(item.id, session.token).catch(() => {})
  }, [item.id, session?.token])
  const submit = async event => {
    event.preventDefault()
    if (!session) return openAuth()
    if (session.user?.role !== 'borrower') return setError('Only borrower accounts can request items.')
    if (!session.user?.emailVerified) return setVerificationOpen(true)
    setError('')
    try {
      await createBorrowRequest(item.id, dates, session.token)
      close()
      showToast('Borrow request sent to ' + item.owner)
    } catch (requestError) { setError(requestError.message) }
  }
  const sendVerification = async () => {
    setSendingVerification(true)
    try {
      const result = await resendVerification(session.token)
      setVerificationOpen(false)
      showToast(result.data.message)
    } catch (requestError) {
      showToast(requestError.message)
    } finally {
      setSendingVerification(false)
    }
  }
  return <div className="modal-backdrop" onClick={close}><div className="modal" onClick={event => event.stopPropagation()}><button className="modal-close" onClick={close}><X size={20}/></button><img className="modal-image" src={item.image} alt={item.title}/><div className="modal-body"><div className="item-category">{item.category}</div><h2>{item.title}</h2><div className="owner modal-owner"><span className="owner-avatar">{initials(item.owner)}</span><span>Listed by <b>{item.owner}</b></span><span className="rating"><Star size={14} fill="currentColor"/>{item.rating}</span></div><p className="modal-copy">Pickup details are shared after your request is approved.</p><div className="modal-location"><MapPin size={15}/><span>Approximate area: {item.location?.area || 'Local area'}, {item.location?.city || 'Your city'}</span></div><div className="modal-price"><span>Borrowing rate + deposit</span><strong>{item.price} · ₹{item.deposit || 0}</strong></div>{availability && <small className="availability-note">{availability.booked.length} booked date range(s), {availability.blocked.length} blocked</small>}<form className="request-form" onSubmit={submit}><label>Start date<input type="date" min={today} required value={dates.startDate} onChange={event => setDates({ ...dates, startDate: event.target.value })}/></label><label>End date<input type="date" min={dates.startDate || today} required value={dates.endDate} onChange={event => setDates({ ...dates, endDate: event.target.value })}/></label>{error && <div className="form-error">{error}</div>}<button className="button primary full" type="submit">{session ? 'Request to borrow' : 'Sign in to request'} <ArrowRight size={17}/></button></form></div></div>{verificationOpen && <VerificationRequiredModal mode="borrower" close={() => setVerificationOpen(false)} verify={sendVerification} loading={sendingVerification}/>}</div>
}

function LegacyDashboard({ session, setAuthOpen, setSelectedItem, showToast, signOut }) {
  const [view, setView] = useState('overview')
  const [bookings, setBookings] = useState([])
  const [listings, setListings] = useState([])
  const [profile, setProfile] = useState(session?.user || null)
  const [loading, setLoading] = useState(Boolean(session))
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileForm, setProfileForm] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [sendingVerification, setSendingVerification] = useState(false)
  const [listingOpen, setListingOpen] = useState(false)
  const [verificationOpen, setVerificationOpen] = useState(false)
  const [editingListing, setEditingListing] = useState(null)
  useEffect(() => {
    if (!session) return
    Promise.all([getProfile(session.token), listBookings(session.token), listMyItems(session.token)]).then(([user, bookingList, itemList]) => { setProfile(user.data); setBookings(bookingList.data); setListings(itemList.data) }).catch(error => showToast(error.message)).finally(() => setLoading(false))
  }, [session])
  if (!session) return <section className="page-section auth-required"><ShieldCheck size={42}/><h1>Your dashboard</h1><p>Sign in to manage your profile, requests, and borrowings.</p><button className="button primary" onClick={() => setAuthOpen(true)}>Sign in to continue</button></section>
  const openProfile = () => {
    setProfileForm({ name: profile.name || '', phone: profile.phone || '', gender: profile.gender || 'prefer_not_to_say', bio: profile.bio || '', city: profile.location?.city || '', area: profile.location?.area || '' })
    setProfileOpen(true)
  }
  const saveProfile = async event => {
    event.preventDefault()
    setSavingProfile(true)
    try {
      const result = await updateProfile(profileForm, session.token)
      setProfile(result.data)
      setProfileOpen(false)
      showToast('Profile updated')
    } catch (error) { showToast(error.message) } finally { setSavingProfile(false) }
  }
  const verifyProfile = async () => {
    setSendingVerification(true)
    try { const result = await resendVerification(session.token); showToast(result.data.message) } catch (error) { showToast(error.message) } finally { setSendingVerification(false) }
  }
  const openListingForm = () => {
    if (profile?.role !== 'lender') return
    if (!profile.emailVerified) return setVerificationOpen(true)
    setEditingListing(null)
    setListingOpen(true)
  }
  const changeStatus = async (booking, status) => {
    try { const result = await updateBookingStatus(booking.id, status, session.token); setBookings(bookings.map(value => value.id === booking.id ? result.data : value)); showToast(`Booking ${status.toLowerCase()}`) } catch (error) { showToast(error.message) }
  }
  const saveListing = async (input, images) => {
    const result = editingListing
      ? await updateItem(editingListing.id, input, session.token)
      : await createItem(input, session.token)
    const uploaded = !editingListing && images?.length ? await Promise.all(images.map(image => uploadItemImage(result.data.id, image, session.token))) : []
    const listing = uploaded.length ? uploaded[uploaded.length - 1].data : result.data
    setListings(editingListing ? listings.map(item => item.id === listing.id ? listing : item) : [listing, ...listings])
    setListingOpen(false)
    setEditingListing(null)
    setView('listings')
    showToast(editingListing ? 'Listing updated successfully' : 'Item listed successfully')
  }
  const removeListing = async listing => {
    if (!window.confirm(`Delete "${listing.title}"? This cannot be undone.`)) return
    try {
      await deleteItem(listing.id, session.token)
      setListings(listings.filter(item => item.id !== listing.id))
      showToast('Listing deleted')
    } catch (error) { showToast(error.message) }
  }
  const toggleListing = async listing => {
    try {
      const result = await updateItemAvailability(listing.id, !listing.available, session.token)
      setListings(listings.map(item => item.id === listing.id ? result.data : item))
      showToast(result.data.available ? 'Listing activated' : 'Listing paused')
    } catch (error) { showToast(error.message) }
  }
  const borrowedBookings = bookings.filter(booking => booking.borrowerId === session.user.id)
  const ownerRequests = bookings.filter(booking => booking.ownerId === session.user.id)
  const visibleBookings = view === 'borrowings' ? borrowedBookings : view === 'listings' ? ownerRequests : bookings.slice(0, 4)
  const viewTitle = view === 'borrowings' ? 'My borrowings' : view === 'listings' ? 'Listing requests' : 'Overview'
  return <section className="dashboard"><aside className="side-nav"><div className="dash-user"><span className="avatar large">{initials(profile?.name)}</span><div><b>{profile?.name}</b><small>{profile?.email}</small><small className="role-label">{roleLabel(profile?.role)}</small></div></div>{[['overview', 'Overview', LayoutDashboard], ['borrowings', 'My borrowings', BookOpen], ['listings', 'My listings', Package]].map(([key, label, Icon]) => <button className={`side-link ${view === key ? 'selected' : ''}`} key={key} onClick={() => setView(key)}><Icon size={18}/>{label}</button>)}<button className="side-link" onClick={signOut}><X size={18}/>Sign out</button></aside><div className="dash-content"><div className="dash-header"><div><p className="eyebrow">YOUR SPACE</p><h1>{viewTitle}</h1><p>{roleLabel(profile?.role)} account · {accountAge(profile?.createdAt)}</p></div><div className="dashboard-actions"><button className="button secondary" onClick={openProfile}><UserIcon/> Update profile</button><button className="button primary" onClick={() => setListingOpen(true)}><Package size={18}/> List an item</button></div></div>{view === 'overview' && <div className="metric-grid"><div className="metric"><div className="metric-top"><span>My borrowings</span><BookOpen size={17}/></div><strong>{borrowedBookings.length}</strong><small>Requests you have sent</small></div><div className="metric"><div className="metric-top"><span>My listings</span><Package size={17}/></div><strong>{listings.length}</strong><small>Items listed by you</small></div><div className="metric"><div className="metric-top"><span>Listing requests</span><Clock3 size={17}/></div><strong>{ownerRequests.length}</strong><small>Requests on your items</small></div><div className="metric"><div className="metric-top"><span>Profile status</span><ShieldCheck size={17}/></div><strong>{profile?.emailVerified ? 'Email verified' : 'Email unverified'}</strong><small>{profile?.emailVerified ? 'Email confirmed' : 'Verify your email'}</small>{!profile?.emailVerified && <button className="small-action verify-action" disabled={sendingVerification} onClick={verifyProfile}>{sendingVerification ? 'Sending…' : 'Verify email'}</button>}</div></div>}{profileOpen && profileForm && <form className="panel profile-editor" onSubmit={saveProfile}><div className="panel-heading"><h2>Update profile</h2><button type="button" className="modal-close inline-close" onClick={() => setProfileOpen(false)}><X size={17}/></button></div><div className="profile-grid"><label>Name<input required value={profileForm.name} onChange={event => setProfileForm({ ...profileForm, name: event.target.value })}/></label><label>Phone<input required value={profileForm.phone} onChange={event => setProfileForm({ ...profileForm, phone: event.target.value })}/></label><label>Gender<select value={profileForm.gender} onChange={event => setProfileForm({ ...profileForm, gender: event.target.value })}><option value="prefer_not_to_say">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="non_binary">Non-binary</option></select></label><label>City<input value={profileForm.city} onChange={event => setProfileForm({ ...profileForm, city: event.target.value })}/></label><label>Area<input value={profileForm.area} onChange={event => setProfileForm({ ...profileForm, area: event.target.value })}/></label><label className="profile-wide">Bio<textarea maxLength="500" value={profileForm.bio} onChange={event => setProfileForm({ ...profileForm, bio: event.target.value })}/></label></div><button className="button primary" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save profile'}</button></form>}{view === 'listings' && <div className="panel booking-panel"><div className="panel-heading"><h2>My listings</h2><small>{listings.length} item(s)</small></div>{!listings.length && !loading && <div className="empty"><Package size={28}/><h3>No listings yet</h3><p>Your items will appear here after you list them.</p></div>}{listings.map(item => <div className="booking-row listing-row" key={item.id}><div><b>{item.title}</b><small>{item.category} · ₹{item.pricePerDay}/day · {item.location?.city || 'Location not set'}</small></div><span className={`status ${item.available ? 'approved' : 'rejected'}`}>{item.available ? 'Available' : 'Unavailable'}</span></div>)}</div>}{view !== 'listings' && <div className="panel booking-panel"><div className="panel-heading"><h2>{view === 'borrowings' ? 'My borrowings' : 'Recent activity'}</h2>{loading && <small>Loading...</small>}</div>{!visibleBookings.length && !loading && <div className="empty"><CalendarDays size={28}/><h3>{view === 'borrowings' ? 'No borrowings yet' : 'No activity yet'}</h3><p>{view === 'borrowings' ? 'Find an item and send your first request.' : 'Your booking activity will appear here.'}</p></div>}{visibleBookings.map(booking => <div className="booking-row" key={booking.id}><div><b>{booking.itemTitle}</b><small><CalendarDays size={13}/> {formatDate(booking.startDate)} — {formatDate(booking.endDate)}</small></div><span className={`status ${booking.status.toLowerCase().replaceAll(' ', '-')}`}>{booking.status}</span>{booking.status === 'Pending' && booking.ownerId === session.user.id && <><button className="small-action" onClick={() => changeStatus(booking, 'Approved')}>Approve</button><button className="small-action reject" onClick={() => changeStatus(booking, 'Rejected')}>Reject</button></>}</div>)}</div>}{listingOpen && <ListingModal close={() => setListingOpen(false)} onSave={saveListing} />}</div></section>
}

function Dashboard({ session, setAuthOpen, showToast, signOut, onProfileUpdated }) {
  const [view, setView] = useState('overview')
  const [profile, setProfile] = useState(session?.user || null)
  const [bookings, setBookings] = useState([])
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(Boolean(session))
  const [listingOpen, setListingOpen] = useState(false)
  const [verificationOpen, setVerificationOpen] = useState(false)
  const [editingListing, setEditingListing] = useState(null)
  const [sendingVerification, setSendingVerification] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileForm, setProfileForm] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    if (!session) return
    const listingRequest = session.user?.role === 'lender' ? listMyItems(session.token) : Promise.resolve({ data: [] })
    Promise.all([getProfile(session.token), listBookings(session.token), listingRequest])
      .then(([user, bookingList, itemList]) => {
        setProfile(user.data)
        setBookings(bookingList.data)
        setListings(itemList.data)
      })
      .catch(error => showToast(error.message))
      .finally(() => setLoading(false))
  }, [session])

  if (!session) return <section className="page-section auth-required"><ShieldCheck size={42}/><h1>Your dashboard</h1><p>Sign in to manage your profile, requests, and borrowings.</p><button className="button primary" onClick={() => setAuthOpen(true)}>Sign in to continue</button></section>
  const isLender = profile?.role === 'lender'
  const borrowedBookings = bookings.filter(booking => booking.borrowerId === session.user.id)
  const ownerRequests = bookings.filter(booking => booking.ownerId === session.user.id)
  const visibleBookings = view === 'borrowings' ? borrowedBookings : ownerRequests
  const openListingForm = () => {
    if (!isLender) return
    if (!profile.emailVerified) return setVerificationOpen(true)
    setEditingListing(null)
    setListingOpen(true)
  }
  const openProfile = () => {
    setProfileForm({
      name: profile?.name || '',
      phone: profile?.phone || '',
      gender: profile?.gender || 'prefer_not_to_say',
      bio: profile?.bio || '',
      city: profile?.location?.city || '',
      area: profile?.location?.area || ''
    })
    setProfileOpen(true)
  }
  const saveProfile = async event => {
    event.preventDefault()
    setSavingProfile(true)
    try {
      const result = await updateProfile(profileForm, session.token)
      setProfile(result.data)
      onProfileUpdated?.(result.data)
      setProfileOpen(false)
      showToast('Profile updated')
    } catch (error) {
      showToast(error.message)
    } finally {
      setSavingProfile(false)
    }
  }
  const submitListing = async (input, images) => {
    const result = editingListing
      ? await updateItem(editingListing.id, input, session.token)
      : await createItem(input, session.token)
    const uploads = !editingListing && images?.length
      ? await Promise.all(images.map(image => uploadItemImage(result.data.id, image, session.token)))
      : []
    const listing = uploads.length ? uploads[uploads.length - 1].data : result.data
    setListings(current => editingListing ? current.map(item => item.id === listing.id ? listing : item) : [listing, ...current])
    setListingOpen(false)
    setEditingListing(null)
    setView('listings')
    showToast(editingListing ? 'Listing updated successfully' : 'Item listed successfully')
  }
  const removeListing = async listing => {
    if (!window.confirm(`Delete "${listing.title}"? This cannot be undone.`)) return
    try {
      await deleteItem(listing.id, session.token)
      setListings(current => current.filter(item => item.id !== listing.id))
      showToast('Listing deleted')
    } catch (error) { showToast(error.message) }
  }
  const toggleListing = async listing => {
    try {
      const result = await updateItemAvailability(listing.id, !listing.available, session.token)
      setListings(current => current.map(item => item.id === listing.id ? result.data : item))
      showToast(result.data.available ? 'Listing activated' : 'Listing paused')
    } catch (error) { showToast(error.message) }
  }
  const resendAccountVerification = async () => {
    setSendingVerification(true)
    try {
      const result = await resendVerification(session.token)
      setVerificationOpen(false)
      showToast(result.data.message)
    } catch (error) { showToast(error.message) }
    finally { setSendingVerification(false) }
  }
  const changeStatus = async (booking, status) => {
    try {
      const result = await updateBookingStatus(booking.id, status, session.token)
      setBookings(current => current.map(value => value.id === booking.id ? result.data : value))
      showToast(`Booking ${status.toLowerCase()}`)
    } catch (error) { showToast(error.message) }
  }
  const title = view === 'listings' ? 'My listings' : view === 'borrowings' ? 'My borrowings' : 'Overview'
  return <section className="dashboard">
    <aside className="side-nav">
      <div className="dash-user"><span className="avatar large">{initials(profile?.name)}</span><div><b>{profile?.name}</b><small>{profile?.email}</small><small className="role-label">{roleLabel(profile?.role)}</small></div></div>
      <button className={`side-link ${view === 'overview' ? 'selected' : ''}`} onClick={() => setView('overview')}><LayoutDashboard size={18}/>Overview</button>
      <button className={`side-link ${view === 'borrowings' ? 'selected' : ''}`} onClick={() => setView('borrowings')}><BookOpen size={18}/>My borrowings</button>
      {isLender && <button className={`side-link ${view === 'listings' ? 'selected' : ''}`} onClick={() => setView('listings')}><Package size={18}/>My listings</button>}
      <button className={`side-link ${profileOpen ? 'selected' : ''}`} onClick={openProfile}><UserIcon/>Update profile</button>
      <button className="side-link" onClick={signOut}><X size={18}/>Sign out</button>
    </aside>
    <div className="dash-content">
      <div className="dash-header"><div><p className="eyebrow">YOUR SPACE</p><h1>{title}</h1><p>{roleLabel(profile?.role)} account · {accountAge(profile?.createdAt)}</p></div><div className="dashboard-actions"><button className="button secondary" onClick={openProfile}><UserIcon/> Update profile</button>{isLender && <button className="button primary" onClick={openListingForm}><Package size={18}/> Add item</button>}</div></div>
      {view === 'overview' && <div className="metric-grid"><div className="metric"><div className="metric-top"><span>My borrowings</span><BookOpen size={17}/></div><strong>{borrowedBookings.length}</strong><small>Requests you have sent</small></div>{isLender && <><div className="metric"><div className="metric-top"><span>My listings</span><Package size={17}/></div><strong>{listings.length}</strong><small>Items listed by you</small></div><div className="metric"><div className="metric-top"><span>Listing requests</span><Clock3 size={17}/></div><strong>{ownerRequests.length}</strong><small>Requests on your items</small></div></>}<div className="metric"><div className="metric-top"><span>Profile status</span><ShieldCheck size={17}/></div><strong>{profile?.emailVerified ? 'Verified' : 'Unverified'}</strong><small>{profile?.emailVerified ? 'Email confirmed' : 'Verify your account'}</small>{!profile?.emailVerified && <button className="small-action verify-action" disabled={sendingVerification} onClick={resendAccountVerification}>{sendingVerification ? 'Sending…' : 'Verify email'}</button>}</div></div>}
      {profileOpen && profileForm && <form className="panel profile-editor" onSubmit={saveProfile}><div className="panel-heading"><h2>Update profile</h2><button type="button" className="modal-close inline-close" onClick={() => setProfileOpen(false)}><X size={17}/></button></div><div className="profile-grid"><label>Name<input required minLength="2" value={profileForm.name} onChange={event => setProfileForm({ ...profileForm, name: event.target.value })}/></label><label>Phone<input required minLength="7" value={profileForm.phone} onChange={event => setProfileForm({ ...profileForm, phone: event.target.value })}/></label><label>Gender<select value={profileForm.gender} onChange={event => setProfileForm({ ...profileForm, gender: event.target.value })}><option value="prefer_not_to_say">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="non_binary">Non-binary</option></select></label><label>City<input value={profileForm.city} onChange={event => setProfileForm({ ...profileForm, city: event.target.value })}/></label><label>Area<input value={profileForm.area} onChange={event => setProfileForm({ ...profileForm, area: event.target.value })}/></label><label className="profile-wide">Bio<textarea maxLength="500" value={profileForm.bio} onChange={event => setProfileForm({ ...profileForm, bio: event.target.value })}/></label></div><button className="button primary" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save profile'}</button></form>}
      {view === 'listings' && isLender && <div className="panel booking-panel"><div className="panel-heading"><h2>My listings</h2><small>{listings.length} item(s)</small></div>{!listings.length && !loading && <div className="empty"><Package size={28}/><h3>No listings yet</h3><p>Your items will appear here after you list them.</p></div>}{listings.map(item => <div className="booking-row listing-row" key={item.id}><div><b>{item.title}</b><small>{item.category} · ₹{item.pricePerDay}/day · {item.location?.city || 'Location not set'}</small></div><span className={`status ${item.available ? 'approved' : 'rejected'}`}>{item.available ? 'Available' : 'Paused'}</span><button className="small-action" onClick={() => { setEditingListing(item); setListingOpen(true) }}>Edit</button><button className="small-action" onClick={() => toggleListing(item)}>{item.available ? 'Pause' : 'Activate'}</button><button className="small-action reject" onClick={() => removeListing(item)}>Delete</button></div>)}</div>}
      {view === 'borrowings' && <div className="panel booking-panel"><div className="panel-heading"><h2>My borrowings</h2>{loading && <small>Loading...</small>}</div>{!visibleBookings.length && !loading && <div className="empty"><CalendarDays size={28}/><h3>No borrowings yet</h3><p>Find an item and send your first request.</p></div>}{visibleBookings.map(booking => <div className="booking-row" key={booking.id}><div><b>{booking.itemTitle}</b><small><CalendarDays size={13}/> {formatDate(booking.startDate)} — {formatDate(booking.endDate)}</small></div><span className={`status ${booking.status.toLowerCase().replaceAll(' ', '-')}`}>{booking.status}</span></div>)}</div>}
      {view === 'overview' && isLender && ownerRequests.length > 0 && <div className="panel booking-panel"><div className="panel-heading"><h2>Recent listing requests</h2></div>{ownerRequests.slice(0, 4).map(booking => <div className="booking-row" key={booking.id}><div><b>{booking.itemTitle}</b><small>{formatDate(booking.startDate)} — {formatDate(booking.endDate)}</small></div><span className={`status ${booking.status.toLowerCase().replaceAll(' ', '-')}`}>{booking.status}</span>{booking.status === 'Pending' && <><button className="small-action" onClick={() => changeStatus(booking, 'Approved')}>Approve</button><button className="small-action reject" onClick={() => changeStatus(booking, 'Rejected')}>Reject</button></>}</div>)}</div>}
      {listingOpen && <ListingModal initialItem={editingListing} close={() => { setListingOpen(false); setEditingListing(null) }} onSave={submitListing} />}
      {verificationOpen && <VerificationRequiredModal close={() => setVerificationOpen(false)} verify={resendAccountVerification} loading={sendingVerification} />}
    </div>
  </section>
}

function VerificationRequiredModal({ mode = 'lender', close, verify, loading }) {
  const borrower = mode === 'borrower'
  return <div className="modal-backdrop" onClick={close}><div className="auth-modal verification-required" onClick={event => event.stopPropagation()}><button className="modal-close" onClick={close}><X size={20}/></button><ShieldCheck size={42}/><p className="eyebrow">ACCOUNT VERIFICATION</p><h2>{borrower ? 'Account Verification Required' : 'Become a Verified Lender'}</h2><p className="modal-copy">{borrower ? 'Your account is not verified yet. To maintain trust and safety on Borrow Hub, only verified users can request to borrow items.' : 'Your account is not verified yet. To maintain trust and safety in Borrow Hub, only verified lenders can list items on the platform.'}</p><p className="modal-copy">{borrower ? 'Please complete your account verification before sending a borrowing request.' : 'Please complete your account verification to start listing items.'}</p><button className="button primary full" onClick={verify} disabled={loading}>{loading ? 'Sending verification email…' : 'Verify My Account'}</button><button className="text-button auth-switch" onClick={close}>Maybe Later</button></div></div>
}

function ListingModal({ initialItem, close, onSave }) {
  const [form, setForm] = useState({ title: initialItem?.title || '', description: initialItem?.description || '', category: initialItem?.category || 'Electronics', condition: initialItem?.condition || 'Good', pricePerDay: initialItem?.pricePerDay ?? '', deposit: initialItem?.deposit ?? '', city: initialItem?.location?.city || '', area: initialItem?.location?.area || '' })
  const [images, setImages] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async event => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      await onSave({ ...form, pricePerDay: Number(form.pricePerDay), deposit: Number(form.deposit) }, images)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }
  return <div className="modal-backdrop" onClick={close}><div className="listing-modal" onClick={event => event.stopPropagation()}><button className="modal-close" onClick={close}><X size={20}/></button><div className="listing-modal-header"><p className="eyebrow">SHARE WITH YOUR COMMUNITY</p><h2>List an item</h2><p>Add the details people need to borrow it.</p></div><form className="listing-form" onSubmit={submit}><label>Item title<input required minLength="3" maxLength="100" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="e.g. Canon EOS camera"/></label><label>Description<textarea required minLength="10" maxLength="2000" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Describe the item and what is included"/></label><label>Photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => { const selected = [...event.target.files].slice(0, 6); setImages(selected) }}/><small>{images.length ? `${images.length} image(s) selected` : 'Up to 6 images, 5 MB each'}</small></label><div className="listing-form-grid"><label>Category<select value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}>{categories.map(([category]) => <option key={category}>{category}</option>)}</select></label><label>Condition<select value={form.condition} onChange={event => setForm({ ...form, condition: event.target.value })}><option>New</option><option>Like New</option><option>Good</option><option>Fair</option></select></label><label>Price per day<input required type="number" min="0" step="1" value={form.pricePerDay} onChange={event => setForm({ ...form, pricePerDay: event.target.value })} placeholder="₹"/></label><label>Deposit<input required type="number" min="0" step="1" value={form.deposit} onChange={event => setForm({ ...form, deposit: event.target.value })} placeholder="₹"/></label><label>City<input required minLength="2" maxLength="100" value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} placeholder="e.g. Bengaluru"/></label><label>Area<input required minLength="2" maxLength="100" value={form.area} onChange={event => setForm({ ...form, area: event.target.value })} placeholder="e.g. Indiranagar"/></label></div>{error && <div className="form-error">{error}</div>}<button className="button primary full" disabled={saving}>{saving ? 'Publishing…' : 'Publish item'} <ArrowRight size={17}/></button></form></div></div>
}


export default MainApp
