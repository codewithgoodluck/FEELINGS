import { useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import MapView from './components/MapView'
import CheckInPanel from './components/CheckInPanel'
import ChatPanel from './components/ChatPanel'
import LocationPrompt from './components/LocationPrompt'
import { createPin } from './utils/db'
import { fuzzLocation, getCurrentPosition } from './utils/location'
import './App.css'

// Panel states
const PANEL = {
  NONE: 'none',
  CHECKIN: 'checkin',
  CHAT: 'chat',
}

export default function App() {
  const { user, loading } = useAuth()
  const [locationAsked, setLocationAsked] = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  const [panel, setPanel] = useState(PANEL.NONE)
  const [pendingLocation, setPendingLocation] = useState(null) // where user tapped
  const [activePin, setActivePin] = useState(null) // pin being chatted about

  if (loading) {
    return (
      <div className="splash">
        <p className="splash-text">HowAreYou</p>
      </div>
    )
  }

  // ── Location permission flow ───────────────────────────────────────────────

  async function handleAllowLocation() {
    try {
      const pos = await getCurrentPosition()
      setUserLocation(pos)
    } catch {
      // Permission denied or unavailable — show world view
      setUserLocation(null)
    }
    setLocationAsked(true)
  }

  function handleSkipLocation() {
    setLocationAsked(true)
    setUserLocation(null)
  }

  // ── Map interactions ───────────────────────────────────────────────────────

  function handleMapClick(lngLat) {
    // Only open check-in if no panel is already open
    if (panel !== PANEL.NONE) {
      setPanel(PANEL.NONE)
      return
    }
    setPendingLocation(lngLat)
    setPanel(PANEL.CHECKIN)
  }

  function handlePinClick(pin) {
    setActivePin(pin)
    setPanel(PANEL.CHAT)
  }

  // ── Check-in submission ────────────────────────────────────────────────────

  async function handleCheckInSubmit({ mood, message }) {
    if (!pendingLocation || !user) return
    const { lat, lng } = fuzzLocation(pendingLocation.lat, pendingLocation.lng)
    await createPin({ uid: user.uid, lat, lng, mood, message })
    setPanel(PANEL.NONE)
    setPendingLocation(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!locationAsked) {
    return (
      <LocationPrompt
        onAllow={handleAllowLocation}
        onSkip={handleSkipLocation}
      />
    )
  }

  return (
    <div className="app">
      {/* Map fills the entire viewport */}
      <MapView
        userLocation={userLocation}
        onMapClick={handleMapClick}
        onPinClick={handlePinClick}
      />

      {/* Floating tap hint */}
      {panel === PANEL.NONE && (
        <div className="tap-hint" aria-live="polite">
          Tap the map to share how you're doing
        </div>
      )}

      {/* Panels */}
      {panel === PANEL.CHECKIN && pendingLocation && (
        <CheckInPanel
          location={pendingLocation}
          onSubmit={handleCheckInSubmit}
          onClose={() => setPanel(PANEL.NONE)}
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
