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

const MOOD_LABELS = {
  '😊': 'Good',    '😔': 'Low',       '😤': 'Frustrated', '😴': 'Tired',
  '🤔': 'Unsure',  '🥳': 'Excited',   '😰': 'Anxious',    '😌': 'Calm',
  '😢': 'Sad',     '😡': 'Angry',     '🤗': 'Grateful',   '🥺': 'Tender',
  '😶': 'Numb',    '🤩': 'Amazed',    '🫶': 'Loved',      '🥱': 'Bored',
}

const CLOSE_MS = 300

export default function PinsPanel({ onClose, onFlyTo, onPinClick, onChatDirect, activePinId, unreadPinIds }) {
  const [pins, setPins]       = useState([])
  const [closing, setClosing] = useState(false)
  const timerRef              = useRef(null)
  const itemEls               = useRef({})

  useEffect(() => subscribeToPins((raw) => {
    const sorted = [...raw].sort((a, b) => {
      const ta = a.createdAt?.seconds ?? Infinity
      const tb = b.createdAt?.seconds ?? Infinity
      return tb - ta
    })
    setPins(sorted)
  }), [])
  useEffect(() => () => clearTimeout(timerRef.current), [])

  // Scroll active pin into view when it changes (pin clicked on map)
  useEffect(() => {
    if (!activePinId) return
    const el = itemEls.current[activePinId]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activePinId])

  function dismiss(afterClose) {
    if (closing) return
    setClosing(true)
    timerRef.current = setTimeout(afterClose ?? onClose, CLOSE_MS)
  }

  function handleSelect(pin) {
    onFlyTo(pin.lng, pin.lat)
    if (window.innerWidth >= 640) {
      onPinClick(pin)
    } else {
      dismiss(() => onPinClick(pin))
    }
  }

  function handleChatDirect(pin) {
    onFlyTo(pin.lng, pin.lat)
    if (window.innerWidth >= 640) {
      onChatDirect(pin)
    } else {
      dismiss(() => onChatDirect(pin))
    }
  }

  return (
    <>
    <div className={`pins-panel-backdrop${closing ? ' pins-panel-backdrop--out' : ''}`} onClick={() => dismiss()} aria-hidden="true" />
    <div className={`pins-panel${closing ? ' pins-panel--closing' : ''}`} role="dialog" aria-label="Live pin feed">

      <div className="pins-panel-header">
        <div className="pins-panel-header-main">
          <h2 className="pins-panel-title">
            <span className="pins-panel-live-dot" aria-hidden="true" />
            Live Feed
          </h2>
          <button className="pins-panel-close" onClick={() => dismiss()} aria-label="Close">✕</button>
        </div>
        <p className="pins-panel-subtitle">
          <span className="pins-panel-count-badge">{pins.length}</span>
          {pins.length === 1 ? 'pin' : 'pins'} active now
        </p>
      </div>

      <div className="pins-panel-list">
        {pins.length === 0 ? (
          <div className="empty-state"><p>No active pins right now.</p></div>
        ) : (
          pins.map(pin => {
            const isActive  = activePinId === pin.id
            const hasUnread = unreadPinIds?.has(pin.id)
            return (
              <div
                key={pin.id}
                ref={el => { itemEls.current[pin.id] = el }}
                className={`pins-panel-item${isActive ? ' pins-panel-item--active' : ''}${hasUnread ? ' pins-panel-item--has-unread' : ''}`}
              >
                <button className="pins-panel-item-body" onClick={() => handleSelect(pin)}>
                  <div className="pins-panel-item-top">
                    <span className="pins-panel-mood-chip">
                      <span aria-hidden="true">{pin.mood}</span>
                      {MOOD_LABELS[pin.mood] ?? 'Feeling'}
                    </span>
                    <div className="pins-panel-item-top-right">
                      {hasUnread && <span className="pins-panel-unread-dot" aria-label="Unread message" />}
                      <span className="pins-panel-time">
                        <span className="pins-panel-time-icon" aria-hidden="true">⏱</span>
                        {timeAgo(pin.createdAt)}
                      </span>
                    </div>
                  </div>
                  {pin.message && <p className="pins-panel-message">{pin.message}</p>}
                  <div className="pins-panel-item-bottom">
                    {pin.country
                      ? <span className="pins-panel-location">
                          {countryFlag(pin.country)}
                          <span>{countryName(pin.country) ?? pin.country}</span>
                        </span>
                      : <span />
                    }
                    <div className="pins-panel-badges">
                      {pin.isFlash   && <span className="pins-panel-badge pins-panel-badge--flash">⚡ flash</span>}
                      {pin.hasStreak && <span className="pins-panel-badge pins-panel-badge--streak">🔥 streak</span>}
                    </div>
                  </div>
                </button>
                <button
                  className={`pins-panel-chat-btn${hasUnread ? ' pins-panel-chat-btn--unread' : ''}`}
                  onClick={() => handleChatDirect(pin)}
                  aria-label="Chat about this pin"
                >
                  {hasUnread ? '💬 New message' : '💬 Chat'}
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
    </>
  )
}
