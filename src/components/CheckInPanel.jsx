// CheckInPanel — slides up when user taps the map
// Lets them choose a mood emoji and write how they're doing

import { useState } from 'react'

const MOODS = [
  { emoji: '😊', label: 'Good' },
  { emoji: '😔', label: 'Low' },
  { emoji: '😤', label: 'Frustrated' },
  { emoji: '😴', label: 'Tired' },
  { emoji: '🤔', label: 'Unsure' },
  { emoji: '🥳', label: 'Excited' },
  { emoji: '😰', label: 'Anxious' },
  { emoji: '😌', label: 'Calm' },
]

export default function CheckInPanel({ location, onSubmit, onClose }) {
  const [selectedMood, setSelectedMood] = useState(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!selectedMood) return
    setSubmitting(true)
    await onSubmit({ mood: selectedMood.emoji, message: message.trim() })
    setSubmitting(false)
  }

  return (
    <div className="panel slide-up" role="dialog" aria-label="Post a check-in">
      <div className="panel-handle" />

      <h2 className="panel-title">How are you doing?</h2>
      <p className="panel-sub">Your pin will disappear in 24 hours.</p>

      <div className="mood-grid" role="group" aria-label="Choose your mood">
        {MOODS.map((m) => (
          <button
            key={m.emoji}
            className={`mood-btn ${selectedMood?.emoji === m.emoji ? 'mood-btn--active' : ''}`}
            onClick={() => setSelectedMood(m)}
            aria-pressed={selectedMood?.emoji === m.emoji}
          >
            <span className="mood-emoji">{m.emoji}</span>
            <span className="mood-label">{m.label}</span>
          </button>
        ))}
      </div>

      <textarea
        className="check-in-text"
        placeholder="Say a bit more (optional)..."
        maxLength={280}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        aria-label="Optional message"
      />
      <p className="char-count">{message.length}/280</p>

      <div className="panel-actions">
        <button className="btn btn--ghost" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button
          className="btn btn--primary"
          onClick={handleSubmit}
          disabled={!selectedMood || submitting}
        >
          {submitting ? 'Posting…' : 'Drop pin'}
        </button>
      </div>
    </div>
  )
}
