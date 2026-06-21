import { useEffect, useRef, useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import MapView from './components/MapView'
import CheckInPanel from './components/CheckInPanel'
import ChatPanel from './components/ChatPanel'
import LocationPrompt from './components/LocationPrompt'
import MirrorPrompt from './components/MirrorPrompt'
import OnboardingTour from './components/OnboardingTour'
import HelpPanel from './components/HelpPanel'
import { createPin, deactivatePin, subscribeToUserConversations, getPin } from './utils/db'
import { fuzzLocation, getCurrentPosition, reverseGeocodeCountry, reverseGeocodePlaceName } from './utils/location'
import { getAnonColour, getAnonIdentity } from './utils/identity'
import { recordCheckIn } from './utils/streak'
import { initPresence, heartbeat, markInactive } from './utils/presence'
import { useToast } from './contexts/ToastContext'
import StatsPanel from './components/StatsPanel'
import './App.css'

const PANEL = { NONE: 'none', CHECKIN: 'checkin', CHAT: 'chat', HELP: 'help', INBOX: 'inbox' }

function useTip(key) {
  const [visible, setVisible] = useState(false)
  function show() { if (localStorage.getItem(`feelin_tip_${key}`) !== '1') setVisible(true) }
  function dismiss() { localStorage.setItem(`feelin_tip_${key}`, '1'); setVisible(false) }
  return [visible, show, dismiss]
}

function useKeyboardOffset() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function update() {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      document.documentElement.style.setProperty('--vv-bottom', offset + 'px')
      // --vv-height = actual visible area height (shrinks when keyboard opens)
      document.documentElement.style.setProperty('--vv-height', vv.height + 'px')
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

  // ── Gates ──────────────────────────────────────────────────────────────────
  const [onboarded, setOnboarded] = useState(
    () => localStorage.getItem('feelin_onboarded') === '1'
  )
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
  const [conversations, setConversations]     = useState([])
  const [placeName, setPlaceName]             = useState(null)
  const [toast, setToast]                     = useState(null)
  const [neighbourhood, setNeighbourhood]     = useState(null) // { mood, count }
  const [wantCheckIn, setWantCheckIn]         = useState(false)
  const [celebration, setCelebration]         = useState(false)
  const prevConvsRef = useRef({})

  // ── Tooltips ────────────────────────────────────────────────────────────────
  const [tipFab, showTipFab, dismissTipFab] = useTip('fab')
  const [tipPin, showTipPin, dismissTipPin] = useTip('pin')

  // Show FAB tip 1.5 s after map loads
  useEffect(() => {
    if (!locationAsked) return
    const t = setTimeout(showTipFab, 1500)
    return () => clearTimeout(t)
  }, [locationAsked]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open check-in after location if "Drop my first pin" was tapped in onboarding
  useEffect(() => {
    if (locationAsked && wantCheckIn) {
      setPendingLocation(userLocation || { lat: 20, lng: 0 })
      setPanel(PANEL.CHECKIN)
      setWantCheckIn(false)
    }
  }, [locationAsked, wantCheckIn]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div className="splash"><p className="splash-text">HowAreYou</p></div>
  }

  // ── Onboarding gate ──────────────────────────────────────────────────────
  if (!onboarded) {
    return (
      <OnboardingTour
        onDone={() => setOnboarded(true)}
        onDropPin={() => {
          setMirrorDone(true)
          sessionStorage.setItem('hay_mirror_done', '1')
          setWantCheckIn(true)
        }}
      />
    )
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
    setPlaceName(null)
    setPanel(PANEL.CHECKIN)
    reverseGeocodePlaceName(lngLat.lat, lngLat.lng).then(setPlaceName).catch(() => {})
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
    // First-pin celebration
    if (localStorage.getItem('feelin_tip_celebration') !== '1') {
      localStorage.setItem('feelin_tip_celebration', '1')
      setCelebration(true)
      setTimeout(() => setCelebration(false), 2800)
    }
  }

  function handleFabClick() {
    dismissTipFab()
    if (panel !== PANEL.NONE) { setPanel(PANEL.NONE); return }
    const loc = userLocation || { lat: 20, lng: 0 }
    setPendingLocation(loc)
    setPlaceName(null)
    setPanel(PANEL.CHECKIN)
    if (userLocation) {
      reverseGeocodePlaceName(loc.lat, loc.lng).then(setPlaceName).catch(() => {})
    }
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
        onFirstPins={showTipPin}
        unreadPinIds={unreadPinIds}
        activePinId={panel === PANEL.CHAT ? activePin?.id : null}
        previewLocation={panel === PANEL.CHECKIN ? pendingLocation : null}
      />

      {user && (
        <NotificationManager
          user={user}
          onUnreadCount={setUnreadCount}
          onUnreadPinIds={setUnreadPinIds}
          onConversations={setConversations}
          onToast={setToast}
          prevConvsRef={prevConvsRef}
        />
      )}

      {toast && (
        <MessageToast text={toast} onDismiss={() => setToast(null)} />
      )}

      {user && <PresenceTracker user={user} userLocation={userLocation} />}

      <StatsPanel />

      {/* Help button */}
      <button
        className="help-btn"
        onClick={() => setPanel(p => p === PANEL.HELP ? PANEL.NONE : PANEL.HELP)}
        aria-label="Help"
      >
        ?
      </button>

      {/* FAB — drop a pin */}
      {panel === PANEL.NONE && (
        <button className="fab" onClick={handleFabClick} aria-label="Share how you're feeling">
          +
          {unreadCount > 0 && (
            <span
              className="fab-badge"
              role="button"
              aria-label={`${unreadCount} unread messages`}
              onClick={(e) => { e.stopPropagation(); setPanel(PANEL.INBOX) }}
            >
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* FAB tooltip */}
      {tipFab && panel === PANEL.NONE && (
        <div className="map-tooltip map-tooltip--fab" onClick={dismissTipFab} role="status">
          <span className="map-tooltip-text">Tap to share how you're feeling</span>
          <button className="map-tooltip-close" onClick={(e) => { e.stopPropagation(); dismissTipFab() }} aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* First-pin tooltip */}
      {tipPin && panel === PANEL.NONE && (
        <div className="map-tooltip map-tooltip--top" onClick={dismissTipPin} role="status">
          <span className="map-tooltip-text">Tap a pin to connect anonymously</span>
          <button className="map-tooltip-close" onClick={(e) => { e.stopPropagation(); dismissTipPin() }} aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* First-pin celebration ripple */}
      {celebration && (
        <div className="celebration" aria-live="polite" aria-atomic="true">
          <div className="celebration-ring" />
          <div className="celebration-ring" />
          <div className="celebration-ring" />
          <p className="celebration-text">✨ Pin dropped!</p>
        </div>
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

      {panel === PANEL.CHECKIN && pendingLocation && (
        <CheckInPanel
          location={pendingLocation}
          onSubmit={handleCheckInSubmit}
          onClose={() => setPanel(PANEL.NONE)}
          initialMood={mirrorMood}
          placeName={placeName}
        />
      )}

      {panel === PANEL.CHAT && activePin && (
        <ChatPanel
          pin={activePin}
          onClose={() => setPanel(PANEL.NONE)}
        />
      )}

      {panel === PANEL.HELP && (
        <HelpPanel onClose={() => setPanel(PANEL.NONE)} />
      )}

      {panel === PANEL.INBOX && (
        <InboxSheet
          conversations={conversations}
          user={user}
          onOpenPin={(pin) => { setActivePin(pin); setPanel(PANEL.CHAT) }}
          onClose={() => setPanel(PANEL.NONE)}
        />
      )}
    </div>
  )
}

// ── Message toast ────────────────────────────────────────────────────────────

function MessageToast({ text, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000)
    return () => clearTimeout(t)
  }, [onDismiss])
  return (
    <div className="msg-toast" onClick={onDismiss} role="alert">
      💬 {text}
    </div>
  )
}

// ── Presence tracker ─────────────────────────────────────────────────────────

function PresenceTracker({ user, userLocation }) {
  useEffect(() => {
    if (!user?.uid) return
    initPresence(user.uid, userLocation?.lat ?? null, userLocation?.lng ?? null)
    const interval = setInterval(() => heartbeat(user.uid), 30_000)
    function onVisibility() {
      if (document.hidden) markInactive(user.uid)
      else heartbeat(user.uid)
    }
    function onUnload() { markInactive(user.uid) }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [user?.uid]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// ── Global messages inbox ─────────────────────────────────────────────────────

function InboxSheet({ conversations, user, onOpenPin, onClose }) {
  const [loadingId, setLoadingId] = useState(null)
  const showToast = useToast()

  const withActivity = conversations.filter((c) => c.lastMessageAt)
  const unread = withActivity.filter((c) => {
    if (c.lastMessageUid === user.uid) return false
    const ts = c.lastMessageAt?.seconds
      ? c.lastMessageAt.seconds * 1000
      : c.lastMessageAt?.toDate?.()?.getTime?.() ?? 0
    return ts > lastSeen(c.id)
  })
  const responded = withActivity.filter((c) => c.lastMessageUid === user.uid)
  const other     = withActivity.filter((c) => !unread.includes(c) && !responded.includes(c))

  async function handleTap(conv) {
    setLoadingId(conv.id)
    try {
      const pin = await getPin(conv.pinId)
      if (!pin) { showToast('This pin has expired.', 'info'); setLoadingId(null); return }
      onOpenPin(pin)
    } catch { showToast("Couldn't open this conversation.", 'error') }
    setLoadingId(null)
  }

  function ConvItem({ conv }) {
    const isLoading = loadingId === conv.id
    const isUnread  = unread.includes(conv)
    const otherUid  = conv.participants?.find((p) => p !== user.uid)
    const name      = otherUid ? getAnonIdentity(otherUid, null) : 'Someone'
    const bg        = otherUid ? getAnonColour(otherUid) : '#444'
    return (
      <button
        className={`inbox-item${isUnread ? ' inbox-item--unread' : ''}`}
        onClick={() => handleTap(conv)}
        disabled={isLoading}
      >
        <div className="inbox-item-avatar" style={{ background: bg }}>
          {conv.lastMessagePreview?.slice(0, 1) || '💬'}
        </div>
        <div className="inbox-item-body">
          <p className="inbox-item-name">{name}</p>
          <p className="inbox-item-preview">{isLoading ? 'Opening…' : (conv.lastMessagePreview || 'No messages yet')}</p>
        </div>
        {isUnread && <span className="inbox-unread-dot" aria-label="Unread" />}
      </button>
    )
  }

  return (
    <div className="panel slide-up inbox-panel" role="dialog" aria-label="Messages inbox">
      <div className="panel-handle" />
      <div className="inbox-header">
        <h2 className="inbox-title">Messages</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>
      {withActivity.length === 0 ? (
        <div className="empty-state"><p>No conversations yet.<br />Tap a pin on the map to start one.</p></div>
      ) : (
        <>
          {unread.length > 0 && (
            <><p className="inbox-section-label">Unread</p>{unread.map((c) => <ConvItem key={c.id} conv={c} />)}</>
          )}
          {responded.length > 0 && (
            <><p className="inbox-section-label">Sent</p>{responded.map((c) => <ConvItem key={c.id} conv={c} />)}</>
          )}
          {other.length > 0 && (
            <><p className="inbox-section-label">Earlier</p>{other.map((c) => <ConvItem key={c.id} conv={c} />)}</>
          )}
        </>
      )}
    </div>
  )
}

// ── Notification manager ──────────────────────────────────────────────────────

function NotificationManager({ user, onUnreadCount, onUnreadPinIds, onConversations, onToast, prevConvsRef }) {
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
          if (prev !== undefined && ts > prevTs) {
            if (notifGranted.current && document.hidden) {
              try {
                new Notification('HowAreYou 💬', {
                  body: conv.lastMessagePreview || 'New message',
                  icon: '/favicon.svg',
                  tag:  conv.id,
                })
              } catch {}
            } else if (!document.hidden) {
              onToast?.(conv.lastMessagePreview || 'New message')
            }
          }
        }
      })
      const next = {}
      convs.forEach((c) => { next[c.id] = c })
      prevConvsRef.current = next
      onUnreadCount(unread)
      onUnreadPinIds(pinIds)
      onConversations?.(convs)
    })
    return unsub
  }, [user?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
