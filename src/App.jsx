import { useEffect, useRef, useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import MapView from './components/MapView'
import CheckInPanel from './components/CheckInPanel'
import ChatPanel from './components/ChatPanel'
import LocationPrompt from './components/LocationPrompt'
import MirrorPrompt from './components/MirrorPrompt'
import { createPin, deactivatePin, subscribeToUserConversations } from './utils/db'
import { fuzzLocation, getCurrentPosition, reverseGeocodeCountry } from './utils/location'
import { recordCheckIn } from './utils/streak'
import './App.css'

const PANEL = { NONE: 'none', CHECKIN: 'checkin', CHAT: 'chat' }

function useKeyboardOffset() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function update() {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      document.documentElement.style.setProperty('--vv-bottom', offset + 'px')
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update) }
  }, [])
}

function lastSeen(convId) {
  try { return parseInt(localStorage.getItem('hay_seen_' + convId) || '0', 10) } catch { return 0 }
}

export default function App() {
  const { user, loading } = useAuth()
  useKeyboardOffset()

  // Mirror — shown once per session before the map loads
  const [mirrorDone, setMirrorDone] = useState(
    () => sessionStorage.getItem('hay_mirror_done') === '1'
  )
  const [mirrorMood, setMirrorMood] = useState(null)

  const [locationAsked, setLocationAsked]     = useState(false)
  const [userLocation, setUserLocation]       = useState(null)
  const [panel, setPanel]                     = useState(PANEL.NONE)
  const [pendingLocation, setPendingLocation] = useState(null)
  const [activePin, setActivePin]             = useState(null)
  const [unreadCount, setUnreadCount]         = useState(0)
  const [unreadPinIds, setUnreadPinIds]       = useState(new Set())
  const [neighbourhood, setNeighbourhood]     = useState(null) // { mood, count }
  const prevConvsRef = useRef({})

  if (loading) {
    return <div className="splash"><p className="splash-text">HowAreYou</p></div>
  }

  // ── Mirror gate ──────────────────────────────────────────────────────────

  if (!mirrorDone) {
    return (
      <MirrorPrompt
        onAnswer={(mood) => {
          setMirrorMood(mood)
          setMirrorDone(true)
          sessionStorage.setItem('hay_mirror_done', '1')
        }}
      />
    )
  }

  // ── Location gate ────────────────────────────────────────────────────────

  async function handleAllowLocation() {
    try { setUserLocation(await getCurrentPosition()) } catch { setUserLocation(null) }
    setLocationAsked(true)
  }
  function handleSkipLocation() { setLocationAsked(true); setUserLocation(null) }

  if (!locationAsked) {
    return <LocationPrompt onAllow={handleAllowLocation} onSkip={handleSkipLocation} />
  }

  // ── Event handlers ───────────────────────────────────────────────────────

  function handleMapClick(lngLat) {
    if (panel !== PANEL.NONE) { setPanel(PANEL.NONE); return }
    setPendingLocation(lngLat)
    setPanel(PANEL.CHECKIN)
  }

  function handlePinClick(pin) {
    setActivePin(pin)
    setPanel(PANEL.CHAT)
  }

  async function handleDeletePin(pinId) {
    await deactivatePin(pinId)
  }

  async function handleCheckInSubmit({ mood, message, isFlash }) {
    if (!pendingLocation || !user) throw new Error('Not ready — please wait a moment and try again')
    const { lat, lng } = fuzzLocation(pendingLocation.lat, pendingLocation.lng)
    const country      = await reverseGeocodeCountry(lat, lng)
    const streakCount  = recordCheckIn()
    const hasStreak    = streakCount >= 7
    await createPin({ uid: user.uid, lat, lng, mood, message, verified: userLocation !== null, country, isFlash, hasStreak })
    setPanel(PANEL.NONE)
    setPendingLocation(null)
  }

  function handleNeighbourhoodClick({ mood, count }) {
    setNeighbourhood({ mood, count })
  }

  return (
    <div className="app">
      <MapView
        userLocation={userLocation}
        onMapClick={handleMapClick}
        onPinClick={handlePinClick}
        onDeletePin={handleDeletePin}
        onNeighbourhoodClick={handleNeighbourhoodClick}
        unreadPinIds={unreadPinIds}
        activePinId={panel === PANEL.CHAT ? activePin?.id : null}
      />

      {user && (
        <NotificationManager
          user={user}
          onUnreadCount={setUnreadCount}
          onUnreadPinIds={setUnreadPinIds}
          prevConvsRef={prevConvsRef}
        />
      )}

      {/* Neighbourhood summary card */}
      {neighbourhood && (
        <div className="neighbourhood-overlay" onClick={() => setNeighbourhood(null)}>
          <div className="neighbourhood-card slide-up" onClick={(e) => e.stopPropagation()}>
            <button className="neighbourhood-close" onClick={() => setNeighbourhood(null)} aria-label="Close">✕</button>
            <div className="neighbourhood-emoji">{neighbourhood.mood}</div>
            <p className="neighbourhood-count">{neighbourhood.count} feeling{neighbourhood.count !== 1 ? 's' : ''} in this area</p>
            <p className="neighbourhood-hint">Tap outside to dismiss</p>
          </div>
        </div>
      )}

      {panel === PANEL.NONE && (
        <div className="tap-hint" aria-live="polite">
          Tap the map to share how you're doing
          {unreadCount > 0 && (
            <span className="tap-hint-badge" aria-label={`${unreadCount} unread`}>{unreadCount}</span>
          )}
        </div>
      )}

      {panel === PANEL.CHECKIN && pendingLocation && (
        <CheckInPanel
          location={pendingLocation}
          onSubmit={handleCheckInSubmit}
          onClose={() => setPanel(PANEL.NONE)}
          initialMood={mirrorMood}
        />
      )}

      {panel === PANEL.CHAT && activePin && (
        <ChatPanel
          pin={activePin}
          onClose={() => setPanel(PANEL.NONE)}
        />
      )}
    </div>
  )
}

// ── Notification manager ──────────────────────────────────────────────────────

function NotificationManager({ user, onUnreadCount, onUnreadPinIds, prevConvsRef }) {
  const notifGranted = useRef(false)

  useEffect(() => {
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') {
      notifGranted.current = true
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then((p) => { notifGranted.current = p === 'granted' })
    }
  }, [])

  useEffect(() => {
    if (!user?.uid) return
    const unsub = subscribeToUserConversations(user.uid, (convs) => {
      let unread = 0
      const pinIds = new Set()
      convs.forEach((conv) => {
        if (!conv.lastMessageAt || conv.lastMessageUid === user.uid) return
        const ts = conv.lastMessageAt?.seconds
          ? conv.lastMessageAt.seconds * 1000
          : conv.lastMessageAt?.toDate?.()?.getTime?.() ?? 0
        if (ts > lastSeen(conv.id)) {
          unread++
          if (conv.pinId) pinIds.add(conv.pinId)
          const prev   = prevConvsRef.current[conv.id]
          const prevTs = prev?.lastMessageAt?.seconds
            ? prev.lastMessageAt.seconds * 1000
            : prev?.lastMessageAt?.toDate?.()?.getTime?.() ?? 0
          if (prev !== undefined && ts > prevTs && notifGranted.current && document.hidden) {
            try {
              new Notification('HowAreYou 💬', {
                body: conv.lastMessagePreview || 'New message',
                icon: '/favicon.svg',
                tag:  conv.id,
              })
            } catch {}
          }
        }
      })
      const next = {}
      convs.forEach((c) => { next[c.id] = c })
      prevConvsRef.current = next
      onUnreadCount(unread)
      onUnreadPinIds(pinIds)
    })
    return unsub
  }, [user?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
