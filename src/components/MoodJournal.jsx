import { useEffect, useState } from 'react'
import { subscribeToUserPins } from '../utils/db'
import { useAuth } from '../contexts/AuthContext'

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

function formatDate(ts) {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  const now = new Date()
  const diffMs = now - d
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatTime(ts) {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

// Group pins by day label
function groupByDay(pins) {
  const groups = []
  let lastLabel = null
  pins.forEach(pin => {
    const label = formatDate(pin.createdAt)
    if (label !== lastLabel) {
      groups.push({ label, pins: [] })
      lastLabel = label
    }
    groups[groups.length - 1].pins.push(pin)
  })
  return groups
}

export default function MoodJournal({ onClose }) {
  const { user } = useAuth()
  const [pins, setPins] = useState(null) // null = loading

  useEffect(() => {
    if (!user?.uid) { setPins([]); return }
    return subscribeToUserPins(user.uid, setPins)
  }, [user?.uid])

  // Mood frequency summary
  const moodCounts = (pins ?? []).reduce((acc, p) => {
    if (p.mood) acc[p.mood] = (acc[p.mood] || 0) + 1
    return acc
  }, {})
  const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]

  const groups = groupByDay(pins ?? [])

  return (
    <div className="panel slide-up journal-panel" role="dialog" aria-label="Mood journal">
      <div className="panel-handle" />

      {/* Header */}
      <div className="journal-header">
        <div>
          <h2 className="panel-title">Your mood journal</h2>
          <p className="panel-sub">Private — only visible to you.</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>

      {/* Summary bar */}
      {pins && pins.length > 0 && (
        <div className="journal-summary">
          <div className="journal-stat">
            <span className="journal-stat-val">{pins.length}</span>
            <span className="journal-stat-label">check-ins</span>
          </div>
          {topMood && (
            <div className="journal-stat">
              <span className="journal-stat-val">{topMood[0]}</span>
              <span className="journal-stat-label">most felt</span>
            </div>
          )}
          <div className="journal-stat">
            <span className="journal-stat-val">{Object.keys(moodCounts).length}</span>
            <span className="journal-stat-label">moods expressed</span>
          </div>
        </div>
      )}

      {/* Mood breakdown chart */}
      {pins && pins.length > 0 && Object.keys(moodCounts).length > 0 && (
        <div className="journal-breakdown">
          <p className="journal-breakdown-title">Mood breakdown</p>
          {Object.entries(moodCounts).sort((a, b) => b[1] - a[1]).map(([emoji, count]) => {
            const pct = Math.round((count / pins.length) * 100)
            return (
              <div key={emoji} className="journal-breakdown-row">
                <span className="journal-breakdown-emoji">{emoji}</span>
                <div className="journal-breakdown-bar-wrap">
                  <div className="journal-breakdown-bar" style={{ width: pct + '%' }} />
                </div>
                <span className="journal-breakdown-pct">{pct}%</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Entries */}
      <div className="journal-list">
        {pins === null ? (
          <p className="journal-empty">Loading…</p>
        ) : pins.length === 0 ? (
          <div className="journal-empty-state">
            <span className="journal-empty-icon">📖</span>
            <p className="journal-empty-title">No check-ins yet</p>
            <p className="journal-empty-sub">Drop your first pin to start your journal.</p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.label} className="journal-group">
              <p className="journal-group-label">{group.label}</p>
              {group.pins.map(pin => (
                <div
                  key={pin.id}
                  className="journal-entry"
                  style={{ '--mood-color': MOOD_COLORS[pin.mood] ?? 'var(--accent)' }}
                >
                  <div className="journal-entry-emoji">{pin.mood}</div>
                  <div className="journal-entry-body">
                    <div className="journal-entry-top">
                      <span className="journal-entry-mood">{MOOD_LABELS[pin.mood] ?? 'Feeling'}</span>
                      <span className="journal-entry-time">{formatTime(pin.createdAt)}</span>
                    </div>
                    {pin.message && (
                      <p className="journal-entry-msg">"{pin.message}"</p>
                    )}
                    <div className="journal-entry-badges">
                      {pin.isFlash      && <span className="journal-badge">⚡ Flash</span>}
                      {pin.hasStreak    && <span className="journal-badge">🔥 Streak</span>}
                      {pin.needsSupport && <span className="journal-badge">❤️‍🩹 SOS</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
