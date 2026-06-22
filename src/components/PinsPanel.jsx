import { useEffect, useState } from 'react'
import { subscribeToPins } from '../utils/db'
import { countryFlag } from '../utils/presence'

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

export default function PinsPanel({ onClose, onFlyTo }) {
  const [pins, setPins] = useState([])

  useEffect(() => subscribeToPins(setPins), [])

  function handleSelect(pin) {
    onFlyTo(pin.lng, pin.lat)
    onClose()
  }

  return (
    <div className="pins-panel" role="dialog" aria-label="Live pin feed">
      <div className="pins-panel-header">
        <h2 className="pins-panel-title">
          Live Pins
          <span className="pins-panel-count">{pins.length}</span>
        </h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="pins-panel-list">
        {pins.length === 0 ? (
          <div className="empty-state"><p>No active pins right now.</p></div>
        ) : (
          pins.map(pin => (
            <button key={pin.id} className="pins-panel-item" onClick={() => handleSelect(pin)}>
              <span className="pins-panel-emoji">{pin.mood}</span>
              <div className="pins-panel-meta">
                {pin.message && (
                  <p className="pins-panel-message">{pin.message}</p>
                )}
                <p className="pins-panel-info">
                  {pin.country ? `${countryFlag(pin.country)} ` : ''}
                  {timeAgo(pin.createdAt)}
                  {pin.isFlash ? ' · ⚡' : ''}
                  {pin.hasStreak ? ' · 🔥' : ''}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
