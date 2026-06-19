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

export default function CheckInPanel({ location, onSubmit, onClose, initialMood }) {
  const [selectedMood, setSelectedMood] = useState(
    initialMood ? (MOODS.find((m) => m.emoji === initialMood) ?? null) : null
  )
  const [message, setMessage]     = useState('')
  const [isFlash, setIsFlash]     = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState('')

  async function handleSubmit() {
    if (!selectedMood) return
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({ mood: selectedMood.emoji, message: message.trim(), isFlash })
    } catch (err) {
      console.error('Post failed:', err)
      setError(err?.message || 'Failed to post. Check your connection.')
      setSubmitting(false)
    }
  }

  return (
    <div className="panel slide-up" role="dialog" aria-label="Post a check-in">
      <div className="panel-handle" />

      {/* Flash / Normal toggle */}
      <div className="pin-type-row">
        <button
          className={`pin-type-btn ${!isFlash ? 'pin-type-btn--active' : ''}`}
          onClick={() => setIsFlash(false)}
        >
          📍 24h pin
        </button>
        <button
          className={`pin-type-btn ${isFlash ? 'pin-type-btn--active' : ''}`}
          onClick={() => setIsFlash(true)}
        >
          ⚡ 60-second flash
        </button>
      </div>

      <h2 className="panel-title">How are you doing?</h2>
      <p className={`panel-sub ${isFlash ? 'panel-sub--flash' : ''}`}>
        {isFlash
          ? '⚡ This pin vanishes in 60 seconds — say it and let it go.'
          : 'Your pin will disappear in 24 hours.'}
      </p>

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

      <div className="privacy-notice" role="note">
        🔒 Keep it anonymous — don't share your name, phone number, or any personal details.
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

      {error && <p style={{ color: '#f08080', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>{error}</p>}

      <div className="panel-actions">
        <button className="btn btn--ghost" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button
          className={`btn ${isFlash ? 'btn--flash' : 'btn--primary'}`}
          onClick={handleSubmit}
          disabled={!selectedMood || submitting}
        >
          {submitting ? 'Posting…' : isFlash ? '⚡ Flash it' : 'Drop pin'}
        </button>
      </div>
    </div>
  )
}
