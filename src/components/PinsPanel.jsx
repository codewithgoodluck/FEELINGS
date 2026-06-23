import { useEffect, useRef, useState } from 'react'
import { subscribeToPins } from '../utils/db'
import { countryFlag, countryName } from '../utils/presence'

function timeAgo(ts) {
  if (!ts) return ''
  const date = ts?.toDate ? ts.toDate() : new Date(ts)
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const CLOSE_MS = 300

export default function PinsPanel({ onClose, onFlyTo, onPinClick, closeSignal = 0 }) {
  const [pins, setPins]       = useState([])
  const [closing, setClosing] = useState(false)
  const timerRef              = useRef(null)
  const dismissRef            = useRef(null)

  useEffect(() => subscribeToPins(setPins), [])
  useEffect(() => () => clearTimeout(timerRef.current), [])

  function dismiss(afterClose) {
    if (closing) return
    setClosing(true)
    timerRef.current = setTimeout(afterClose ?? onClose, CLOSE_MS)
  }

  dismissRef.current = dismiss

  useEffect(() => {
    if (closeSignal > 0) dismissRef.current()
  }, [closeSignal])

  function handleSelect(pin) {
    onFlyTo(pin.lng, pin.lat)
    if (window.innerWidth >= 640) {
      onPinClick(pin)
    } else {
      dismiss(() => onPinClick(pin))
    }
  }

  return (
    <>
    <div className={`pins-panel-backdrop${closing ? ' pins-panel-backdrop--out' : ''}`} onClick={() => dismiss()} aria-hidden="true" />
    <div className={`pins-panel${closing ? ' pins-panel--closing' : ''}`} role="dialog" aria-label="Live pin feed">
      <div className="pins-panel-header">
        <div className="pins-panel-header-text">
          <h2 className="pins-panel-title">
            <span className="pins-panel-live-dot" aria-hidden="true" />
            Live Pins
          </h2>
          <p className="pins-panel-subtitle">
            {pins.length} {pins.length === 1 ? 'pin' : 'pins'} active right now
          </p>
        </div>
        <button className="pins-panel-close" onClick={() => dismiss()} aria-label="Close">✕</button>
      </div>
      <div className="pins-panel-list">
        {pins.length === 0 ? (
          <div className="empty-state"><p>No active pins right now.</p></div>
        ) : (
          pins.map(pin => (
            <button key={pin.id} className="pins-panel-item" onClick={() => handleSelect(pin)}>
              <div className="pins-panel-mood-row">
                <span className="pins-panel-mood-tag">{pin.mood}</span>
                <span className="pins-panel-time">{timeAgo(pin.createdAt)}</span>
              </div>
              {pin.message
                ? <p className="pins-panel-message">{pin.message}</p>
                : <p className="pins-panel-no-msg">No message</p>
              }
              <div className="pins-panel-footer">
                {pin.country && (
                  <span className="pins-panel-location">
                    {countryFlag(pin.country)}
                    {countryName(pin.country) && <span>{countryName(pin.country)}</span>}
                  </span>
                )}
                {pin.isFlash  && <span className="pins-panel-badge pins-panel-badge--flash">⚡ flash</span>}
                {pin.hasStreak && <span className="pins-panel-badge pins-panel-badge--streak">🔥 streak</span>}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
    </>
  )
}
