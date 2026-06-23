import { useEffect, useRef, useState } from 'react'
import { subscribeToPins } from '../utils/db'
import { countryFlag, countryName } from '../utils/presence'
import { useTheme } from '../hooks/useTheme'
import { deactivatePin } from '../utils/db'

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

const MOOD_COLORS = {
  '😊': '#e8c468', '😔': '#5b8af5', '😤': '#fb5607', '😴': '#8338ec',
  '🤔': '#81b29a', '🥳': '#ffb703', '😰': '#e07a5f', '😌': '#06d6a0',
  '😢': '#5b8af5', '😡': '#e84040', '🤗': '#06d6a0', '🥺': '#e07a5f',
  '😶': '#888',    '🤩': '#ffb703', '🫶': '#e07a5f', '🥱': '#888',
}

const REACTION_EMOJIS = ['💙', '🤝', '❤️']

const CLOSE_MS = 300

export default function PinsPanel({ onClose, onFlyTo, onPinClick, onChatDirect, activePinId, unreadPinIds, currentUserId, onDeletePin, blockedUids }) {
  const { theme, toggle: toggleTheme } = useTheme()
  const [pins, setPins]           = useState([])
  const [moodFilter, setMoodFilter] = useState(null)
  const [closing, setClosing]     = useState(false)
  const timerRef                  = useRef(null)
  const itemEls                   = useRef({})

  useEffect(() => subscribeToPins((raw) => {
    const sorted = [...raw].sort((a, b) => {
      const ta = a.createdAt?.seconds ?? Infinity
      const tb = b.createdAt?.seconds ?? Infinity
      return tb - ta
    })
    setPins(sorted)
  }), [])
  useEffect(() => () => clearTimeout(timerRef.current), [])

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

  // Mood summary: count per emoji, sorted by count desc
  const moodCounts = pins.reduce((acc, p) => {
    if (p.mood) acc[p.mood] = (acc[p.mood] || 0) + 1
    return acc
  }, {})
  const topMoods = Object.entries(moodCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  return (
    <>
      <div
        className={`pins-panel-backdrop${closing ? ' pins-panel-backdrop--out' : ''}`}
        onClick={() => dismiss()}
        aria-hidden="true"
      />
      <div
        className={`pins-panel${closing ? ' pins-panel--closing' : ''}`}
        role="dialog"
        aria-label="Activity feed"
      >
        {/* ── Header ── */}
        <div className="pins-panel-header">
          <div className="pins-panel-header-main">
            <h2 className="pins-panel-title">
              <span className="pins-panel-live-dot" aria-hidden="true" />
              Activity
            </h2>
            <div className="pins-panel-header-actions">
              <button
                className="pins-panel-theme-btn"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              >
                {theme === 'dark' ? '☀' : '🌙'}
              </button>
              <button className="pins-panel-close" onClick={() => dismiss()} aria-label="Close">✕</button>
            </div>
          </div>
          <p className="pins-panel-subtitle">
            <span className="pins-panel-count-badge">{pins.length}</span>
            {pins.length === 1 ? 'check-in' : 'check-ins'} live right now
          </p>
        </div>

        {/* ── Mood filter strip ── */}
        {topMoods.length > 0 && (
          <div className="feed-mood-strip">
            {topMoods.map(([emoji, count]) => (
              <button
                key={emoji}
                className={`feed-mood-pill${moodFilter === emoji ? ' feed-mood-pill--active' : ''}`}
                onClick={() => setMoodFilter(f => f === emoji ? null : emoji)}
                aria-pressed={moodFilter === emoji}
                title={`Filter by ${emoji}`}
              >
                <span className="feed-mood-pill-emoji">{emoji}</span>
                <span className="feed-mood-pill-count">{count}</span>
              </button>
            ))}
            {moodFilter && (
              <button
                className="feed-mood-clear"
                onClick={() => setMoodFilter(null)}
                aria-label="Clear filter"
              >
                ✕ clear
              </button>
            )}
          </div>
        )}

        {/* ── Cards ── */}
        <div className="pins-panel-list">
          {moodFilter && (
            <p className="feed-filter-label">Showing {pins.filter(p => p.mood === moodFilter).length} people feeling {moodFilter}</p>
          )}
          {(moodFilter ? pins.filter(p => p.mood === moodFilter) : pins).filter(p => !blockedUids?.has(p.uid)).length === 0 && pins.length > 0 && moodFilter && (
            <p className="feed-filter-label">No unblocked pins with this mood right now.</p>
          )}
          {pins.length === 0 ? (
            <div className="feed-empty">
              <span className="feed-empty-icon">🌍</span>
              <p className="feed-empty-text">No check-ins yet.</p>
              <p className="feed-empty-sub">Be the first to share how you feel.</p>
            </div>
          ) : (
            (moodFilter ? pins.filter(p => p.mood === moodFilter) : pins).filter(p => !blockedUids?.has(p.uid)).map(pin => {
              const isActive  = activePinId === pin.id
              const hasUnread = unreadPinIds?.has(pin.id)
              const isOwn     = currentUserId && pin.uid === currentUserId
              const accentColor = pin.needsSupport ? '#e05050' : (MOOD_COLORS[pin.mood] ?? 'var(--accent)')

              return (
                <article
                  key={pin.id}
                  ref={el => { itemEls.current[pin.id] = el }}
                  className={[
                    'feed-card',
                    isActive         ? 'feed-card--active'  : '',
                    hasUnread        ? 'feed-card--unread'  : '',
                    pin.needsSupport ? 'feed-card--sos'     : '',
                    isOwn            ? 'feed-card--own'     : '',
                  ].filter(Boolean).join(' ')}
                  style={{ '--mood-color': accentColor }}
                >
                  <button className="feed-card-body" onClick={() => handleSelect(pin)}>
                    {/* Mood emoji */}
                    <div className="feed-card-emoji-wrap" aria-hidden="true">
                      <span className="feed-card-emoji">{pin.mood || '💬'}</span>
                    </div>

                    {/* Content */}
                    <div className="feed-card-content">
                      <div className="feed-card-top">
                        <span className="feed-card-mood-label">
                          {MOOD_LABELS[pin.mood] ?? 'Feeling something'}
                        </span>
                        <span className="feed-card-time">{timeAgo(pin.createdAt)}</span>
                      </div>

                      {pin.country && (
                        <div className="feed-card-location">
                          <span aria-hidden="true">{countryFlag(pin.country)}</span>
                          <span>{countryName(pin.country) ?? pin.country}</span>
                        </div>
                      )}

                      {pin.message && (
                        <p className="feed-card-message">"{pin.message}"</p>
                      )}
                      {pin.reactions && (() => {
                        const hits = REACTION_EMOJIS.filter(e => (pin.reactions[e]?.length ?? 0) > 0)
                        const tot  = hits.reduce((s, e) => s + (pin.reactions[e]?.length ?? 0), 0)
                        return hits.length > 0 ? <p className="feed-card-reactions">{hits.join('')} {tot}</p> : null
                      })()}
                    </div>
                  </button>

                  {/* Footer: badges + actions */}
                  <div className="feed-card-footer">
                    <div className="feed-card-badges">
                      {isOwn            && <span className="feed-badge feed-badge--own">✦ You</span>}
                      {pin.needsSupport && <span className="feed-badge feed-badge--sos">❤️‍🩹 Needs support</span>}
                      {pin.isFlash      && <span className="feed-badge feed-badge--flash">⚡ Flash</span>}
                      {pin.hasStreak    && <span className="feed-badge feed-badge--streak">🔥 Streak</span>}
                      {pin.voiceUrl     && <span className="feed-badge feed-badge--voice">🎙 Voice</span>}
                      {hasUnread        && <span className="feed-badge feed-badge--new">● New</span>}
                    </div>
                    <div className="feed-card-actions">
                      {isOwn && (
                        <button
                          className="feed-card-delete"
                          onClick={async (e) => {
                            e.stopPropagation()
                            await deactivatePin(pin.id)
                            onDeletePin?.(pin.id)
                          }}
                          aria-label="Remove your pin"
                          title="Remove my pin"
                        >
                          🗑
                        </button>
                      )}
                      {!isOwn && (
                        <button
                          className={`feed-card-chat${hasUnread ? ' feed-card-chat--unread' : ''}`}
                          onClick={() => handleChatDirect(pin)}
                          aria-label="Open chat for this pin"
                        >
                          💬 {hasUnread ? 'New msg' : 'Chat'}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
