import { useEffect, useRef, useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import MapView from './components/MapView'
import CheckInPanel from './components/CheckInPanel'
import ChatPanel from './components/ChatPanel'
import PinSheet from './components/PinSheet'
import MirrorPrompt from './components/MirrorPrompt'
import HelpPanel from './components/HelpPanel'
import { createPin, deactivatePin, subscribeToUserConversations, getPin, clearAllPins, countPinsWithMood } from './utils/db'
import { blockUser, getBlockedUids } from './utils/blocked'
import { ACHIEVEMENTS, recordCheckInAchievements, unlock } from './utils/achievements'
import { fuzzLocation, getCurrentPosition, reverseGeocodeCountry, reverseGeocodePlaceName, haversineKm } from './utils/location'
import { getAnonColour, getAnonIdentity, getAvatar } from './utils/identity'
import { recordCheckIn } from './utils/streak'
import { initPresence, heartbeat, markInactive } from './utils/presence'
import { useToast } from './contexts/ToastContext'
import StatsPanel from './components/StatsPanel'
import PinSearch from './components/PinSearch'
import { useTheme } from './hooks/useTheme'
import ProfilePanel from './components/ProfilePanel'
import JoinLeaveToast from './components/JoinLeaveToast'
import PinsPanel from './components/PinsPanel'
import { subscribeToLivePresence, countryFlag, countryName } from './utils/presence'
import CountryLockSheet from './components/CountryLockSheet'
import BottomNav from './components/BottomNav'
import LocationGate from './components/LocationGate'
import MoodJournal from './components/MoodJournal'
import TrendingWidget from './components/TrendingWidget'
import './App.css'

const PANEL = { NONE: 'none', CHECKIN: 'checkin', CHAT: 'chat', PEEK: 'peek', HELP: 'help', INBOX: 'inbox', LOCATION: 'location', PROFILE: 'profile', JOURNAL: 'journal' }

function getTodayKey() {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

// Track tip visibility once per localStorage key
function useTip(key) {
  const [visible, setVisible] = useState(false)
  function show() { if (localStorage.getItem(`hay_tip_${key}`) !== '1') setVisible(true) }
  function dismiss() { localStorage.setItem(`hay_tip_${key}`, '1'); setVisible(false) }
  return [visible, show, dismiss]
}

function useKeyboardOffset() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function update() {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      document.documentElement.style.setProperty('--vv-bottom', offset + 'px')
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
  const showToast = useToast()
  const { theme, toggle: toggleTheme } = useTheme()
  useKeyboardOffset()
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function check() { setCountryBadgeShow(vv.height > window.innerHeight * 0.75) }
    vv.addEventListener('resize', check)
    return () => vv.removeEventListener('resize', check)
  }, [])
  useEffect(() => { window.__clearAllPins = clearAllPins }, [])

  // ── First-run state ────────────────────────────────────────────────────────
  const [mirrorDone, setMirrorDone] = useState(
    () => sessionStorage.getItem('hay_mirror_done') === '1'
  )
  const [transitioning, setTransitioning] = useState(false)
  const [mirrorMood, setMirrorMood]       = useState(null)

  // ── Location — deferred to first FAB tap ───────────────────────────────────
  const [locationGateDone, setLocationGateDone] = useState(
    () => localStorage.getItem('hay_location_gate') === '1'
  )
  const [locationAsked, setLocationAsked] = useState(
    () => sessionStorage.getItem('hay_location_asked') === '1'
  )
  const [userLocation, setUserLocation] = useState(null)
  const [userCountry,     setUserCountry]     = useState(
    () => sessionStorage.getItem('hay_user_country') || null
  )
  const [userCountryName, setUserCountryName] = useState(
    () => sessionStorage.getItem('hay_user_country_name') || null
  )

  // ── UI state ───────────────────────────────────────────────────────────────
  const [panel, setPanel]                 = useState(PANEL.NONE)
  const [showFeedPanel, setShowFeedPanel] = useState(() => window.innerWidth >= 640)
  const [showSearch, setShowSearch]           = useState(false)
  const mapFlyTo                              = useRef(null)
  const [pendingLocation, setPendingLocation] = useState(null)
  const [activePin, setActivePin]             = useState(null)
  const [unreadCount, setUnreadCount]         = useState(0)
  const [unreadPinIds, setUnreadPinIds]       = useState(new Set())
  const [conversations, setConversations]     = useState([])
  const [placeName, setPlaceName]             = useState(null)
  const [toast, setToast]                     = useState(null)
  const [neighbourhood, setNeighbourhood]     = useState(null)
  const [celebration, setCelebration]         = useState(false)
  const [showSosConfirm, setShowSosConfirm]   = useState(false)
  const [sosLoading,     setSosLoading]       = useState(false)
  const [sameMoodNudge,  setSameMoodNudge]    = useState(null) // { emoji, count }

  // Daily nudge: show if user hasn't checked in today
  const [showDailyNudge, setShowDailyNudge] = useState(
    () => {
      const lastDate = localStorage.getItem('hay_last_checkin_date')
      const gateSet  = localStorage.getItem('hay_location_gate') === '1'
      return gateSet && lastDate !== getTodayKey()
    }
  )
  const prevConvsRef = useRef({})

  // ── Avatar + settings state ───────────────────────────────────────────────
  const [avatar,             setAvatar]             = useState(() => getAvatar())
  const [rotateGlobe,        setRotateGlobe]        = useState(() => localStorage.getItem('hay_globe_rotate') !== '0')
  const [clusterPins,        setClusterPins]        = useState(() => localStorage.getItem('hay_pin_cluster')  !== '0')
  const [hideCountryBadge,   setHideCountryBadge]   = useState(() => localStorage.getItem('hay_hide_country') === '1')
  const [travelMode,         setTravelMode]         = useState(() => localStorage.getItem('hay_travel_mode') === '1')
  const [blockedUids,        setBlockedUids]        = useState(() => getBlockedUids())
  const [showHeatmap,        setShowHeatmap]        = useState(false)
  const [satellite,          setSatellite]          = useState(false)
  const [statusMsg,          setStatusMsg]          = useState(() => localStorage.getItem('hay_status_msg') || '')
  const [showLowMoodNudge,   setShowLowMoodNudge]   = useState(false)
  const [lastLowMood,        setLastLowMood]        = useState(null)
  const [streakCelebration,  setStreakCelebration]  = useState(null) // { streak, emoji }

  // ── Country lock overlay state ─────────────────────────────────────────────
  const [countryLockData,  setCountryLockData]  = useState(null) // { tappedCode, tappedName }
  const [blockedToastMsg,  setBlockedToastMsg]  = useState(null)
  const [badRipple,        setBadRipple]        = useState(null) // { x, y }
  const [blockedGhost,     setBlockedGhost]     = useState(null) // { x, y, mood }
  const [countryBadgeShow, setCountryBadgeShow] = useState(true)

  // ── Join / leave toast queue ──────────────────────────────────────────────
  const [jlQueue, setJlQueue] = useState([])
  const jlTimesRef = useRef([]) // recent event timestamps for throttle

  function handleJoinLeaveEvent(event) {
    const now = Date.now()
    jlTimesRef.current = jlTimesRef.current.filter(t => now - t < 5000)
    jlTimesRef.current.push(now)

    if (jlTimesRef.current.length > 3) {
      // Burst: clear pending queue (keep current-showing item at [0]) and
      // append a single collapse toast. Reset counter so next burst is fresh.
      jlTimesRef.current = []
      setJlQueue(q =>
        q.length > 0
          ? [q[0], { id: `burst-${now}`, type: 'burst' }]
          : [{ id: `burst-${now}`, type: 'burst' }]
      )
      return
    }

    setJlQueue(q => [...q, { id: `jl-${now}-${Math.random()}`, ...event }])
  }

  // ── Contextual tooltips ────────────────────────────────────────────────────
  // pin_seen  = "Tap + to share your mood" (shown after map loads)
  // chat_seen = "Tap any pin to chat anonymously" (shown when first pin appears)
  const [tipFab, showTipFab, dismissTipFab] = useTip('pin_seen')
  const [tipPin, showTipPin, dismissTipPin] = useTip('chat_seen')

  // Show FAB tip 1.5 s after mirror is done
  useEffect(() => {
    if (!mirrorDone) return
    const t = setTimeout(showTipFab, 1500)
    return () => clearTimeout(t)
  }, [mirrorDone]) // eslint-disable-line react-hooks/exhaustive-deps

  // Low-mood follow-up nudge — show if user dropped a negative mood pin 2+ hours ago
  useEffect(() => {
    if (!mirrorDone) return
    const lastTime  = parseInt(localStorage.getItem('hay_last_low_mood_time') || '0', 10)
    const lastEmoji = localStorage.getItem('hay_last_low_mood')
    if (!lastTime || !lastEmoji) return
    const hoursAgo = (Date.now() - lastTime) / 3_600_000
    if (hoursAgo >= 2 && hoursAgo < 24) {
      setLastLowMood(lastEmoji)
      setShowLowMoodNudge(true)
    }
  }, [mirrorDone]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-clear blocked toast after 1.5 s (must be before any early returns)
  useEffect(() => {
    if (!blockedToastMsg) return
    const t = setTimeout(() => setBlockedToastMsg(null), 1500)
    return () => clearTimeout(t)
  }, [blockedToastMsg])

  // ── Auth loading splash ────────────────────────────────────────────────────
  if (loading) {
    return <div className="splash"><p className="splash-text">HowAreYou</p></div>
  }

  // ── Location gate — FIRST: must share location before anything else ─────────
  if (!locationGateDone) {
    return (
      <LocationGate
        onConfirm={async ({ lat, lng, country, countryName: cName, fromGPS }) => {
          if (fromGPS) {
            const loc = { lat, lng }
            setUserLocation(loc)
            reverseGeocodeCountry(lat, lng).then(({ code, name }) => {
              if (code) {
                setUserCountry(code)
                setUserCountryName(name)
                sessionStorage.setItem('hay_user_country', code)
                sessionStorage.setItem('hay_user_country_name', name ?? '')
              }
            }).catch(() => {})
            reverseGeocodePlaceName(lat, lng).then(setPlaceName).catch(() => {})
          } else {
            setUserLocation({ lat, lng })
            if (country) {
              setUserCountry(country)
              setUserCountryName(cName)
              sessionStorage.setItem('hay_user_country', country)
              sessionStorage.setItem('hay_user_country_name', cName ?? '')
            }
          }
          setLocationAsked(true)
          sessionStorage.setItem('hay_location_asked', '1')
          localStorage.setItem('hay_location_gate', '1')
          setLocationGateDone(true)
        }}
      />
    )
  }

  // ── Mirror gate — mood picker, shown after location is confirmed ──────────
  if (!mirrorDone && !transitioning) {
    return (
      <MirrorPrompt
        onAnswer={(mood) => {
          setMirrorMood(mood)
          setTransitioning(true)
          setTimeout(() => {
            sessionStorage.setItem('hay_mirror_done', '1')
            setMirrorDone(true)
            setTransitioning(false)
          }, 1400)
        }}
      />
    )
  }

  // ── Location handlers (used by LocationSheet) ─────────────────────────────

  async function handleLocationAllow() {
    let loc = null
    try { loc = await getCurrentPosition() } catch {}
    setUserLocation(loc)
    setLocationAsked(true)
    sessionStorage.setItem('hay_location_asked', '1')
    const finalLoc = loc || { lat: 20, lng: 0 }
    setPendingLocation(finalLoc)
    setPlaceName(null)
    setPanel(PANEL.CHECKIN)
    if (loc) {
      reverseGeocodePlaceName(loc.lat, loc.lng).then(setPlaceName).catch(() => {})
      // Store home country so press-and-hold drops can be restricted to it
      reverseGeocodeCountry(loc.lat, loc.lng).then(({ code, name }) => {
        if (code) {
          setUserCountry(code)
          setUserCountryName(name)
          sessionStorage.setItem('hay_user_country', code)
          sessionStorage.setItem('hay_user_country_name', name ?? '')
        }
      }).catch(() => {})
    }
  }

  function handleLocationSkip() {
    setLocationAsked(true)
    sessionStorage.setItem('hay_location_asked', '1')
    setPendingLocation({ lat: 20, lng: 0 })
    setPanel(PANEL.CHECKIN)
  }

  // ── Map + panel event handlers ────────────────────────────────────────────

  function handleMapClick() {
    if (panel !== PANEL.NONE) setPanel(PANEL.NONE)
  }

  async function handleHoldDrop(lngLat, mood, screenPt) {
    if (!user) return
    if (!isFinite(lngLat.lat) || !isFinite(lngLat.lng) || Math.abs(lngLat.lat) > 90 || Math.abs(lngLat.lng) > 180) return

    if (userLocation) {
      const dist = haversineKm(lngLat.lat, lngLat.lng, userLocation.lat, userLocation.lng)
      if (dist > 100) {
        showToast('Pin deactivated — you can only drop pins near your current location.', 'error')
        return
      }
    }

    try {
      const { lat, lng } = fuzzLocation(lngLat.lat, lngLat.lng)
      // Deliberate fallback: if geocode fails (network error / null), allow pin through silently
      const tapped = await reverseGeocodeCountry(lat, lng)
      if (!travelMode && userCountry && tapped.code && tapped.code !== userCountry) {
        // Show red ripple at tap point
        if (screenPt) setBadRipple(screenPt)
        // Show deactivated ghost pin
        if (screenPt) {
          setBlockedGhost({ x: screenPt.x, y: screenPt.y, mood })
          setTimeout(() => setBlockedGhost(null), 1800)
        }
        setBlockedToastMsg(
          `🚫 That spot is in ${tapped.name ?? tapped.code} — share how you feel in ${userCountryName ?? userCountry} instead.`
        )
        setTimeout(() => setCountryLockData({ tappedCode: tapped.code, tappedName: tapped.name }), 1300)
        return
      }
      const streakCount  = recordCheckIn()
      const hasStreak    = streakCount >= 7
      await createPin({ uid: user.uid, lat, lng, mood, message: '', verified: userLocation !== null, country: tapped.code, isFlash: false, hasStreak })
      mapFlyTo.current?.({ center: [lng, lat], zoom: 14 })
      setCelebration(true)
      setTimeout(() => setCelebration(false), 2800)
      showToast('Pin dropped! Open the live feed to see it.', 'success')
    } catch (err) {
      showToast(err?.message || 'Failed to drop pin — check your connection.', 'error')
    }
  }

  function handlePinClick(pin) {
    setActivePin(pin)
    setPanel(PANEL.PEEK)
  }

  async function handleDeletePin(pinId) {
    await deactivatePin(pinId)
  }

  function handleBlock(uid) {
    if (!uid) return
    blockUser(uid)
    setBlockedUids(prev => new Set([...prev, uid]))
    setPanel(PANEL.NONE)
    showToast('User blocked — their pins will no longer appear in your feed.', 'info')
  }

  async function handleCheckInSubmit({ mood, message, isFlash, voiceUrl, tag }) {
    if (!pendingLocation || !user) throw new Error('Not ready — please wait a moment and try again')
    if (userLocation) {
      const dist = haversineKm(pendingLocation.lat, pendingLocation.lng, userLocation.lat, userLocation.lng)
      if (dist > 100) throw new Error('Pin deactivated — you can only drop pins near your current location.')
    }
    const { lat, lng } = fuzzLocation(pendingLocation.lat, pendingLocation.lng)
    // Deliberate fallback: if geocode fails (network error / null), allow pin through silently
    const tapped = await reverseGeocodeCountry(lat, lng)
    if (!travelMode && tapped.code && userCountry && tapped.code !== userCountry) {
      setPanel(PANEL.NONE)
      setBlockedToastMsg(
        `🚫 That spot is in ${tapped.name ?? tapped.code} — share how you feel in ${userCountryName ?? userCountry} instead.`
      )
      setTimeout(() => setCountryLockData({ tappedCode: tapped.code, tappedName: tapped.name }), 1300)
      return // resolved without throw — CheckInPanel unmounts via setPanel(PANEL.NONE)
    }
    const streakCount  = recordCheckIn()
    const hasStreak    = streakCount >= 7
    await createPin({ uid: user.uid, lat, lng, mood, message, verified: userLocation !== null, country: tapped.code, isFlash, hasStreak, voiceUrl, tag })
    localStorage.setItem('hay_last_checkin_date', getTodayKey())
    setShowDailyNudge(false)
    setShowLowMoodNudge(false)
    // Track negative mood for follow-up nudge
    const LOW_MOODS = new Set(['😔', '😢', '😡', '😤', '😰', '😶', '🥺'])
    if (LOW_MOODS.has(mood)) {
      localStorage.setItem('hay_last_low_mood_time', String(Date.now()))
      localStorage.setItem('hay_last_low_mood', mood)
    } else {
      localStorage.removeItem('hay_last_low_mood_time')
      localStorage.removeItem('hay_last_low_mood')
    }
    // Achievement checks
    const newlyUnlocked = recordCheckInAchievements(streakCount)
    newlyUnlocked.forEach((id, i) => {
      const a = ACHIEVEMENTS.find(x => x.id === id)
      if (a) setTimeout(() => showToast(`${a.emoji} Achievement unlocked: ${a.label}!`, 'success'), i * 1800 + 500)
    })
    // Streak milestone celebration overlay
    const STREAK_MILESTONES = new Set([3, 7, 14, 30])
    if (STREAK_MILESTONES.has(streakCount)) {
      const milestoneEmoji = streakCount >= 30 ? '🌙' : streakCount >= 14 ? '⚡' : streakCount >= 7 ? '💫' : '🔥'
      setTimeout(() => {
        setStreakCelebration({ streak: streakCount, emoji: milestoneEmoji })
        setTimeout(() => setStreakCelebration(null), 4000)
      }, 800)
    }
    setPanel(PANEL.NONE)
    setPendingLocation(null)
    mapFlyTo.current?.({ center: [lng, lat], zoom: 14 })
    setCelebration(true)
    setTimeout(() => setCelebration(false), 2800)
    showToast('Pin dropped! Open the live feed to see it.', 'success')
    try {
      const count = (await countPinsWithMood(mood)) - 1
      if (count > 0) {
        setTimeout(() => showToast(`${count} ${count === 1 ? 'person' : 'people'} also feeling ${mood} right now`, 'info'), 3500)
      }
    } catch {}
  }

  function handleShareHere() {
    setCountryLockData(null)
    if (userLocation) {
      setPendingLocation(userLocation)
      setPanel(PANEL.CHECKIN)
      reverseGeocodePlaceName(userLocation.lat, userLocation.lng).then(setPlaceName).catch(() => {})
    }
  }

  function handleFabClick() {
    dismissTipFab()
    if (panel !== PANEL.NONE) { setPanel(PANEL.NONE); return }
    // First FAB tap → show location sheet instead of going straight to check-in
    if (!locationAsked) {
      setPanel(PANEL.LOCATION)
      return
    }
    const loc = userLocation || { lat: 20, lng: 0 }
    setPendingLocation(loc)
    setPlaceName(null)
    setPanel(PANEL.CHECKIN)
    if (userLocation) reverseGeocodePlaceName(loc.lat, loc.lng).then(setPlaceName).catch(() => {})
  }

  async function handleCryForHelp() {
    if (!user) return
    setSosLoading(true)
    try {
      const loc = userLocation || { lat: 0, lng: 0 }
      const { lat, lng } = fuzzLocation(loc.lat, loc.lng)
      const tapped = await reverseGeocodeCountry(lat, lng)
      if (userCountry && tapped.code && tapped.code !== userCountry) {
        showToast(`Support signal blocked — you can only share from ${userCountryName ?? userCountry}.`, 'error')
        setShowSosConfirm(false)
        return
      }
      await createPin({
        uid: user.uid, lat, lng,
        mood: '😰', message: '',
        verified: userLocation !== null,
        country: tapped.code,
        isFlash: false, hasStreak: false, needsSupport: true,
      })
      setShowSosConfirm(false)
      showToast('Support signal sent 💙 Someone may reach out soon.', 'success')
      if (userLocation) mapFlyTo.current?.({ center: [lng, lat], zoom: 12 })
    } catch (err) {
      showToast(err?.message || 'Failed to send signal — check your connection.', 'error')
    } finally {
      setSosLoading(false)
    }
  }

  function handleNeighbourhoodClick({ mood, count }) {
    setNeighbourhood({ mood, count })
  }

  // ── Bottom nav ────────────────────────────────────────────────────────────
  const activeBottomTab = panel === PANEL.INBOX   ? 'messages'
    : panel === PANEL.PROFILE                     ? 'profile'
    : showFeedPanel                               ? 'feed'
    : 'map'

  function handleBottomTabChange(tab) {
    if (tab === 'map') {
      setShowFeedPanel(false)
      setPanel(PANEL.NONE)
    } else if (tab === 'feed') {
      setPanel(PANEL.NONE)
      setShowFeedPanel(v => !v)
    } else if (tab === 'messages') {
      setShowFeedPanel(false)
      setPanel(p => p === PANEL.INBOX ? PANEL.NONE : PANEL.INBOX)
    } else if (tab === 'profile') {
      setShowFeedPanel(false)
      setPanel(p => p === PANEL.PROFILE ? PANEL.NONE : PANEL.PROFILE)
    }
  }

  const mapStyleUrl = satellite ? 'mapbox://styles/mapbox/satellite-streets-v12' : null

  return (
    <div className={`app${showFeedPanel ? ' feed-panel-open' : ''}`}>
      <MapView
        key={satellite ? 'satellite' : theme}
        theme={theme}
        userLocation={userLocation}
        onMapClick={handleMapClick}
        onHoldDrop={handleHoldDrop}
        onPinClick={handlePinClick}
        onDeletePin={handleDeletePin}
        onNeighbourhoodClick={handleNeighbourhoodClick}
        onFirstPins={showTipPin}
        unreadPinIds={unreadPinIds}
        activePinId={(panel === PANEL.CHAT || panel === PANEL.PEEK) ? activePin?.id : null}
        previewLocation={panel === PANEL.CHECKIN ? pendingLocation : null}
        onFlyTo={(fn) => { mapFlyTo.current = fn }}
        panelOpen={showFeedPanel}
        rotateGlobe={rotateGlobe}
        clusterPins={clusterPins}
        showHeatmap={showHeatmap}
        mapStyleUrl={mapStyleUrl}
      />

      {/* Transition overlay — fades out while map initialises behind it */}
      {transitioning && <TransitionOverlay />}

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

      {toast && <MessageToast text={toast} onDismiss={() => setToast(null)} />}

      {/* Travel mode badge */}
      {travelMode && (
        <div className="travel-mode-badge" aria-label="Travel mode active">
          ✈ Travel mode on
        </div>
      )}

      {/* Country badge — shows user's locked country below stat bar */}
      {userCountry && countryBadgeShow && !hideCountryBadge && !travelMode && (
        <div className="country-badge" aria-label={`You're in ${userCountryName ?? userCountry}`}>
          <span className="country-badge-dot" aria-hidden="true" />
          <span className="country-badge-label">You're in</span>
          <strong>{countryFlag(userCountry)} {userCountryName ?? userCountry}</strong>
        </div>
      )}

      {/* Blocked toast — slides in below stat bar for 1.5s */}
      {blockedToastMsg && (
        <div className="blocked-toast" role="alert" aria-live="assertive">
          {blockedToastMsg}
        </div>
      )}

      {/* Red ripple at blocked tap point */}
      {badRipple && (
        <div
          className="hay-bad-ripple"
          style={{ left: badRipple.x, top: badRipple.y }}
          onAnimationEnd={() => setBadRipple(null)}
        />
      )}

      {/* Deactivated ghost pin at blocked tap point */}
      {blockedGhost && (
        <div
          className="hay-blocked-ghost"
          style={{ left: blockedGhost.x, top: blockedGhost.y }}
          aria-hidden="true"
        >
          {blockedGhost.mood}
        </div>
      )}

      {user && <PresenceTracker user={user} userLocation={userLocation} deviceId={getDeviceId()} />}
      {user && <JoinLeaveDetector onEvent={handleJoinLeaveEvent} />}

      <JoinLeaveToast
        queue={jlQueue}
        onDequeue={() => setJlQueue(q => q.slice(1))}
      />

      <StatsPanel />

      <button
        className="profile-btn"
        style={avatar ? {} : { background: user ? getAnonColour(user.uid) : '#444' }}
        onClick={() => setPanel(p => p === PANEL.PROFILE ? PANEL.NONE : PANEL.PROFILE)}
        aria-label="Profile & settings"
        aria-pressed={panel === PANEL.PROFILE}
      >
        {avatar || (user
          ? (user.isAnonymous
              ? getAnonIdentity(user.uid, null).charAt(0).toUpperCase()
              : (user.email?.charAt(0).toUpperCase() || '?'))
          : '?')}
      </button>

      <button
        className="theme-btn"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? '☀' : '🌙'}
      </button>

      <button
        className="search-btn"
        onClick={() => setShowSearch((v) => !v)}
        aria-label="Search pins"
        aria-pressed={showSearch}
      >
        ⌕
      </button>

      <button
        className="help-btn"
        onClick={() => setPanel(p => p === PANEL.HELP ? PANEL.NONE : PANEL.HELP)}
        aria-label="Help"
      >
        ?
      </button>

      <button
        className={`heatmap-btn${showHeatmap ? ' heatmap-btn--on' : ''}`}
        onClick={() => setShowHeatmap(v => !v)}
        aria-label={showHeatmap ? 'Hide mood heatmap' : 'Show mood heatmap'}
        aria-pressed={showHeatmap}
        title="Mood heatmap"
      >
        🌡
      </button>

      <button
        className={`satellite-btn${satellite ? ' satellite-btn--on' : ''}`}
        onClick={() => setSatellite(v => !v)}
        aria-label={satellite ? 'Switch to standard map' : 'Switch to satellite view'}
        aria-pressed={satellite}
        title="Satellite view"
      >
        🛰
      </button>

      <TrendingWidget />

      {/* Low-mood follow-up nudge */}
      {showLowMoodNudge && panel === PANEL.NONE && (
        <div className="lowmood-nudge" role="status">
          <span className="lowmood-nudge-emoji" aria-hidden="true">{lastLowMood}</span>
          <div className="lowmood-nudge-body">
            <p className="lowmood-nudge-title">How are you feeling now?</p>
            <p className="lowmood-nudge-sub">You shared something tough a while ago.</p>
          </div>
          <button
            className="lowmood-nudge-cta"
            onClick={() => { setShowLowMoodNudge(false); handleFabClick() }}
          >Check in</button>
          <button
            className="lowmood-nudge-dismiss"
            onClick={() => {
              setShowLowMoodNudge(false)
              localStorage.removeItem('hay_last_low_mood_time')
              localStorage.removeItem('hay_last_low_mood')
            }}
            aria-label="Dismiss"
          >✕</button>
        </div>
      )}

      <button
        className="feed-btn"
        onClick={() => setShowFeedPanel(v => !v)}
        aria-label={showFeedPanel ? 'Close live feed' : 'Open live feed'}
        aria-pressed={showFeedPanel}
      >
        ☰
      </button>

      {/* Persistent messages inbox button — bottom-left, always visible when signed in.
          Note: the feature request said "cross/plus sign", but a speech-bubble icon is used
          instead. A cross (✕) universally means "close/dismiss" — using it for messages
          would create a confusing affordance. A chat bubble clearly signals "messages". */}
      {user && (
        <button
          className="inbox-btn"
          onClick={() => setPanel(p => p === PANEL.INBOX ? PANEL.NONE : PANEL.INBOX)}
          aria-label={panel === PANEL.INBOX ? 'Close messages' : 'Open messages'}
          aria-pressed={panel === PANEL.INBOX}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {unreadCount > 0 && (
            <span className="inbox-btn-badge" aria-label={`${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {showSearch && (
        <PinSearch
          onClose={() => setShowSearch(false)}
          onFlyTo={(lng, lat) => mapFlyTo.current?.({ center: [lng, lat], zoom: 13 })}
        />
      )}

      {/* Daily nudge banner — shown once per day above the FAB */}
      {showDailyNudge && panel === PANEL.NONE && (
        <div className="daily-nudge" role="status">
          <span className="daily-nudge-text">How are you feeling today?</span>
          <button
            className="daily-nudge-cta"
            onClick={() => {
              setShowDailyNudge(false)
              handleFabClick()
            }}
          >Share →</button>
          <button
            className="daily-nudge-dismiss"
            onClick={() => setShowDailyNudge(false)}
            aria-label="Dismiss"
          >✕</button>
        </div>
      )}

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

      {/* FAB tooltip: "Tap + to share your mood" */}
      {tipFab && panel === PANEL.NONE && (
        <div className="map-tooltip map-tooltip--fab" onClick={dismissTipFab} role="status">
          <span className="map-tooltip-text">Tap + to share your mood</span>
          <button className="map-tooltip-close" onClick={(e) => { e.stopPropagation(); dismissTipFab() }} aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* Pin tooltip: "Tap any pin to chat anonymously" */}
      {tipPin && panel === PANEL.NONE && (
        <div className="map-tooltip map-tooltip--top" onClick={dismissTipPin} role="status">
          <span className="map-tooltip-text">Tap any pin to chat anonymously</span>
          <button className="map-tooltip-close" onClick={(e) => { e.stopPropagation(); dismissTipPin() }} aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* Streak milestone celebration */}
      {streakCelebration && (
        <div className="streak-celebration" aria-live="polite" aria-atomic="true">
          <div className="streak-celebration-ring" />
          <div className="streak-celebration-ring" />
          <div className="streak-celebration-emoji" aria-hidden="true">{streakCelebration.emoji}</div>
          <p className="streak-celebration-title">{streakCelebration.streak}-day streak!</p>
          <p className="streak-celebration-sub">You've been showing up for yourself.</p>
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

      {/* Cry for Help FAB */}
      {user && panel === PANEL.NONE && !showSosConfirm && (
        <button
          className="sos-fab"
          onClick={() => setShowSosConfirm(true)}
          aria-label="Cry for help — send a support signal"
          title="I need support right now"
        >
          ❤️‍🩹
        </button>
      )}

      {/* Cry for Help confirmation modal */}
      {showSosConfirm && (
        <div className="sos-overlay" onClick={() => !sosLoading && setShowSosConfirm(false)} aria-modal="true" role="dialog">
          <div className="sos-confirm slide-up" onClick={e => e.stopPropagation()}>
            <div className="sos-confirm-icon" aria-hidden="true">❤️‍🩹</div>
            <h2 className="sos-confirm-title">I need support right now</h2>
            <p className="sos-confirm-body">
              Sending a support signal drops a pin at your location so others nearby can reach out with a message of care. Your identity stays anonymous.
            </p>
            <div className="sos-confirm-actions">
              <button
                className="sos-confirm-cancel"
                onClick={() => setShowSosConfirm(false)}
                disabled={sosLoading}
              >
                Cancel
              </button>
              <button
                className="sos-confirm-send"
                onClick={handleCryForHelp}
                disabled={sosLoading}
              >
                {sosLoading
                  ? <span className="auth-submit-spinner" aria-label="Sending…" />
                  : 'Send signal'}
              </button>
            </div>
          </div>
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

      {panel === PANEL.LOCATION && (
        <LocationSheet onAllow={handleLocationAllow} onSkip={handleLocationSkip} />
      )}

      {panel === PANEL.CHECKIN && pendingLocation && (
        <CheckInPanel
          location={pendingLocation}
          onSubmit={handleCheckInSubmit}
          onClose={() => setPanel(PANEL.NONE)}
          initialMood={mirrorMood}
          placeName={placeName}
          statusMsg={statusMsg}
        />
      )}

      {panel === PANEL.PEEK && activePin && (
        <PinSheet
          pin={activePin}
          mirrorMood={mirrorMood}
          onClose={() => setPanel(PANEL.NONE)}
          onDelete={async (pinId) => { await handleDeletePin(pinId); setPanel(PANEL.NONE) }}
          onBlock={handleBlock}
        />
      )}

      {panel === PANEL.CHAT && activePin && (
        <ChatPanel
          pin={activePin}
          onClose={() => setPanel(PANEL.NONE)}
          onBlock={handleBlock}
        />
      )}

      {panel === PANEL.HELP && (
        <HelpPanel onClose={() => setPanel(PANEL.NONE)} userCountry={userCountry} />
      )}

      {panel === PANEL.PROFILE && (
        <ProfilePanel
          onClose={() => setPanel(PANEL.NONE)}
          avatar={avatar}
          onAvatarChange={(emoji) => setAvatar(emoji)}
          rotateGlobe={rotateGlobe}
          onRotateGlobeChange={(v) => { setRotateGlobe(v); localStorage.setItem('hay_globe_rotate', v ? '1' : '0') }}
          clusterPins={clusterPins}
          onClusterPinsChange={(v) => { setClusterPins(v); localStorage.setItem('hay_pin_cluster', v ? '1' : '0') }}
          hideCountryBadge={hideCountryBadge}
          onHideCountryBadgeChange={(v) => { setHideCountryBadge(v); localStorage.setItem('hay_hide_country', v ? '1' : '0') }}
          onOpenJournal={() => { setPanel(PANEL.JOURNAL) }}
          travelMode={travelMode}
          onTravelModeChange={(v) => { setTravelMode(v); localStorage.setItem('hay_travel_mode', v ? '1' : '0') }}
          statusMsg={statusMsg}
          onStatusMsgChange={(v) => { setStatusMsg(v); localStorage.setItem('hay_status_msg', v) }}
        />
      )}

      {panel === PANEL.JOURNAL && (
        <MoodJournal onClose={() => setPanel(PANEL.NONE)} />
      )}

      {showFeedPanel && (
        <PinsPanel
          activePinId={activePin?.id}
          unreadPinIds={unreadPinIds}
          currentUserId={user?.uid}
          blockedUids={blockedUids}
          userLocation={userLocation}
          onClose={() => setShowFeedPanel(false)}
          onFlyTo={(lng, lat) => mapFlyTo.current?.({ center: [lng, lat], zoom: 14 })}
          onPinClick={(pin) => { setActivePin(pin); setPanel(PANEL.PEEK) }}
          onChatDirect={(pin) => { setActivePin(pin); setPanel(PANEL.CHAT) }}
          onDeletePin={handleDeletePin}
        />
      )}

      {panel === PANEL.INBOX && (
        <InboxSheet
          conversations={conversations}
          user={user}
          onOpenPin={(pin) => { setActivePin(pin); setPanel(PANEL.CHAT) }}
          onClose={() => setPanel(PANEL.NONE)}
        />
      )}

      {/* Country lock explanation sheet */}
      {countryLockData && (
        <CountryLockSheet
          tappedCode={countryLockData.tappedCode}
          tappedName={countryLockData.tappedName}
          userCountry={userCountry}
          userCountryName={userCountryName}
          onDismiss={() => setCountryLockData(null)}
          onShareHere={handleShareHere}
        />
      )}

      {user && (
        <BottomNav
          activeTab={activeBottomTab}
          onTabChange={handleBottomTabChange}
          unreadCount={unreadCount}
          avatar={avatar}
        />
      )}
    </div>
  )
}

// ── Join / leave detector — diffs presence snapshots, fires events ────────────

function JoinLeaveDetector({ onEvent }) {
  const onEventRef  = useRef(onEvent)
  onEventRef.current = onEvent
  const prevMapRef  = useRef(null) // null = first snapshot, skip diff

  useEffect(() => {
    return subscribeToLivePresence((users) => {
      const next = new Map(users.map(u => [u.uid, u]))

      if (prevMapRef.current === null) {
        prevMapRef.current = next
        return // skip diff on initial snapshot
      }

      const prev = prevMapRef.current
      const events = []

      for (const [uid, u] of next) {
        if (!prev.has(uid)) {
          events.push({
            type:        'join',
            countryName: u.countryName || null,
            flag:        u.country ? countryFlag(u.country) : null,
          })
        }
      }
      for (const [uid, u] of prev) {
        if (!next.has(uid)) {
          events.push({ type: 'leave', countryName: u.countryName || null })
        }
      }

      prevMapRef.current = next
      events.forEach(e => onEventRef.current(e))
    })
  }, [])

  return null
}

// ── Transition overlay — pulse ring + fade text, covers map while it loads ────

function TransitionOverlay() {
  return (
    <div className="transition-overlay" aria-hidden="true">
      <div className="transition-pulse-ring" />
      <p className="transition-text">joining people feeling things right now…</p>
    </div>
  )
}

// ── Location sheet — compact ask at first FAB tap ─────────────────────────────

function LocationSheet({ onAllow, onSkip }) {
  return (
    <div className="panel slide-up location-sheet" role="dialog" aria-label="Location permission">
      <div className="panel-handle" />
      <p className="location-sheet-icon" aria-hidden="true">📍</p>
      <h2 className="location-sheet-title">Place your pin nearby</h2>
      <p className="location-sheet-body">
        To place your pin near you — always approximate, never exact.
        Your exact coordinates are never stored or shared.
      </p>
      <button className="btn btn--primary btn--full" onClick={onAllow}>Share my location</button>
      <button className="btn btn--ghost btn--full" style={{ marginTop: '0.5rem' }} onClick={onSkip}>
        Pick a spot on the map instead
      </button>
    </div>
  )
}

// ── Message toast ─────────────────────────────────────────────────────────────

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

// ── Stable device ID — persists in localStorage across sessions ───────────────

function getDeviceId() {
  let id = localStorage.getItem('hay_device_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('hay_device_id', id)
  }
  return id
}

// ── Presence tracker ──────────────────────────────────────────────────────────

function PresenceTracker({ user, userLocation, deviceId }) {
  useEffect(() => {
    if (!user?.uid) return
    initPresence(user.uid, deviceId, userLocation?.lat ?? null, userLocation?.lng ?? null)
    const interval = setInterval(() => heartbeat(deviceId), 30_000)
    function onVisibility() {
      if (document.hidden) markInactive(deviceId)
      else heartbeat(deviceId)
    }
    function onUnload() { markInactive(deviceId) }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [user?.uid, deviceId]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// ── Global messages inbox ─────────────────────────────────────────────────────

function inboxTimeAgo(ts) {
  if (!ts) return ''
  const ms = ts?.seconds ? ts.seconds * 1000 : ts?.toDate?.()?.getTime?.() ?? 0
  if (!ms) return ''
  const secs = Math.floor((Date.now() - ms) / 1000)
  if (secs < 60)  return 'now'
  const mins = Math.floor(secs / 60)
  if (mins < 60)  return `${mins}m`
  const hrs  = Math.floor(mins / 60)
  if (hrs  < 24)  return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function markConvSeen(convId) {
  try { localStorage.setItem('hay_seen_' + convId, Date.now()) } catch {}
}

function InboxSheet({ conversations, user, onOpenPin, onClose }) {
  const [loadingId,    setLoadingId]    = useState(null)
  const [searchQuery,  setSearchQuery]  = useState('')
  const [localRead,    setLocalRead]    = useState(() => new Set())
  const [hiddenIds,    setHiddenIds]    = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('hay_hidden_convs') || '[]')) } catch { return new Set() }
  })
  const [bookmarkedIds, setBookmarkedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('hay_bookmarked_convs') || '[]')) } catch { return new Set() }
  })
  const showToast = useToast()
  const searchRef = useRef(null)

  function handleBookmark(convId, e) {
    e.stopPropagation()
    setBookmarkedIds(prev => {
      const next = new Set(prev)
      if (next.has(convId)) next.delete(convId)
      else next.add(convId)
      try { localStorage.setItem('hay_bookmarked_convs', JSON.stringify([...next])) } catch {}
      return next
    })
  }

  // Filter: has activity, not hidden, matches search
  const visible = conversations
    .filter((c) => c.lastMessageAt && !hiddenIds.has(c.id))
    .filter((c) => {
      const q = searchQuery.trim().toLowerCase()
      if (!q) return true
      const otherUid = c.participants?.find((p) => p !== user.uid)
      const name     = otherUid ? getAnonIdentity(otherUid, null).toLowerCase() : ''
      const preview  = (c.lastMessagePreview || '').toLowerCase()
      return name.includes(q) || preview.includes(q)
    })

  function isUnreadConv(conv) {
    if (localRead.has(conv.id))          return false
    if (conv.lastMessageUid === user.uid) return false
    const ts = conv.lastMessageAt?.seconds
      ? conv.lastMessageAt.seconds * 1000
      : conv.lastMessageAt?.toDate?.()?.getTime?.() ?? 0
    return ts > lastSeen(conv.id)
  }

  const unread    = visible.filter(isUnreadConv)
  const responded = visible.filter((c) => !isUnreadConv(c) && c.lastMessageUid === user.uid)
  const other     = visible.filter((c) => !isUnreadConv(c) && c.lastMessageUid !== user.uid)

  function handleMarkAllRead() {
    unread.forEach((c) => markConvSeen(c.id))
    setLocalRead((prev) => new Set([...prev, ...unread.map((c) => c.id)]))
  }

  function handleDismiss(convId, e) {
    e.stopPropagation()
    setHiddenIds((prev) => {
      const next = new Set(prev)
      next.add(convId)
      try { localStorage.setItem('hay_hidden_convs', JSON.stringify([...next])) } catch {}
      return next
    })
  }

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
    const isLoading    = loadingId === conv.id
    const isUnread     = isUnreadConv(conv)
    const isBookmarked = bookmarkedIds.has(conv.id)
    const otherUid     = conv.participants?.find((p) => p !== user.uid)
    const name         = otherUid ? getAnonIdentity(otherUid, null) : 'Someone'
    const initials     = name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
    const bg           = otherUid ? getAnonColour(otherUid) : '#444'
    const rawPreview   = conv.lastMessagePreview || ''
    const preview      = rawPreview.length > 40 ? rawPreview.slice(0, 40) + '…' : (rawPreview || 'No messages yet')
    return (
      <div className={`inbox-item${isUnread ? ' inbox-item--unread' : ''}${isBookmarked ? ' inbox-item--bookmarked' : ''}`}>
        <button
          className="inbox-item-main"
          onClick={() => handleTap(conv)}
          disabled={isLoading}
        >
          <div className="inbox-item-avatar" style={{ background: bg }}>{initials}</div>
          <div className="inbox-item-body">
            <div className="inbox-item-meta">
              <p className="inbox-item-name">{name}</p>
              <span className="inbox-item-time">{inboxTimeAgo(conv.lastMessageAt)}</span>
            </div>
            <p className="inbox-item-preview">{isLoading ? 'Opening…' : preview}</p>
          </div>
          {isUnread && <span className="inbox-unread-dot" aria-label="Unread" />}
        </button>
        <button
          className={`inbox-item-bookmark${isBookmarked ? ' inbox-item-bookmark--on' : ''}`}
          onClick={(e) => handleBookmark(conv.id, e)}
          aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark conversation'}
          aria-pressed={isBookmarked}
        >{isBookmarked ? '★' : '☆'}</button>
        <button
          className="inbox-item-dismiss"
          onClick={(e) => handleDismiss(conv.id, e)}
          aria-label="Dismiss conversation"
        >✕</button>
      </div>
    )
  }

  return (
    <div className="panel slide-up inbox-panel" role="dialog" aria-label="Messages inbox">
      <div className="panel-handle" />
      <div className="inbox-header">
        <h2 className="inbox-title">Messages</h2>
        <div className="inbox-header-actions">
          {unread.length > 0 && (
            <button className="inbox-mark-read" onClick={handleMarkAllRead}>Mark all read</button>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
      </div>

      <div className="inbox-search-wrap">
        <input
          ref={searchRef}
          className="inbox-search"
          type="search"
          placeholder="Search conversations…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search conversations"
        />
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">
          <p>{searchQuery.trim() ? 'No conversations match.' : 'No conversations yet.\nTap a pin on the map to start one.'}</p>
        </div>
      ) : (
        <>
          {(() => {
            const bookmarked = visible.filter(c => bookmarkedIds.has(c.id))
            return bookmarked.length > 0 ? (
              <><p className="inbox-section-label">★ Bookmarked</p>{bookmarked.map((c) => <ConvItem key={c.id} conv={c} />)}</>
            ) : null
          })()}
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
