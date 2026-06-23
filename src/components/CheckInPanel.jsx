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
  { emoji: '😢', label: 'Sad' },
  { emoji: '😡', label: 'Angry' },
  { emoji: '🤗', label: 'Grateful' },
  { emoji: '🥺', label: 'Tender' },
  { emoji: '😶', label: 'Numb' },
  { emoji: '🤩', label: 'Amazed' },
  { emoji: '🫶', label: 'Loved' },
  { emoji: '🥱', label: 'Bored' },
]

export default function CheckInPanel({ location, onSubmit, onClose, initialMood, placeName }) {
  const [selectedMood, setSelectedMood] = useState(
    initialMood ? (MOODS.find((m) => m.emoji === initialMood) ?? null) : null
  )
  const [message, setMessage]       = useState('')
  const [isFlash, setIsFlash]       = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  async function handleSubmit() {
    if (!selectedMood) return
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({ mood: selectedMood.emoji, message: message.trim(), isFlash })
    } catch (err) {
      setError(err?.message || 'Failed to post. Check your connection.')
      setSubmitting(false)
    }
  }

  return (
    <div className="panel slide-up checkin-panel" role="dialog" aria-label="Post a check-in">
      <div className="panel-handle" />

      {/* Scrollable content area */}
      <div className="checkin-scroll">

        {/* Flash / Normal toggle */}
        <div className="pin-type-row">
          <button
            className={`pin-type-btn${!isFlash ? ' pin-type-btn--active' : ''}`}
            onClick={() => setIsFlash(false)}
          >
            📍 24h pin
          </button>
          <button
            className={`pin-type-btn${isFlash ? ' pin-type-btn--active' : ''}`}
            onClick={() => setIsFlash(true)}
          >
            ⚡ 60s flash
          </button>
        </div>

        <h2 className="panel-title">How are you doing?</h2>
        {placeName && (
          <p className="checkin-location-label">📍 Near {placeName}</p>
        )}
        <p className={`panel-sub${isFlash ? ' panel-sub--flash' : ''}`}>
          {isFlash
            ? '⚡ Vanishes in 60 seconds — say it and let it go.'
            : 'Your pin disappears in 24 hours.'}
        </p>

        <div className="mood-grid" role="group" aria-label="Choose your mood">
          {MOODS.map((m) => (
            <button
              key={m.emoji}
              className={`mood-btn${selectedMood?.emoji === m.emoji ? ' mood-btn--active' : ''}`}
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
          placeholder="Say a bit more… (optional)"
          maxLength={280}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-label="Optional message"
        />
        <p className="char-count">{message.length}/280</p>

        <p className="privacy-notice" role="note">
          🔒 Keep it anonymous — don't share personal details.
        </p>

        {error && <p className="checkin-error">{error}</p>}
      </div>

      {/* Sticky footer — always visible */}
      <div className="checkin-footer">
        <button className="btn btn--ghost" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button
          className={`btn${isFlash ? ' btn--flash' : ' btn--primary'}`}
          onClick={handleSubmit}
          disabled={!selectedMood || submitting}
        >
          {submitting ? 'Posting…' : isFlash ? '⚡ Flash it' : 'Drop pin'}
        </button>
      </div>
    </div>
  )
}
