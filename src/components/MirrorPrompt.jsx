import { useState } from 'react'

const MOODS = [
  '😊', '😔', '😤', '😴',
  '🤔', '🥳', '😰', '😌',
  '😢', '😡', '🤗', '🥺',
  '😶', '🤩', '🫶', '🥱',
]

export default function MirrorPrompt({ onAnswer }) {
  const [selected, setSelected] = useState(null)
  const [joining,  setJoining]  = useState(false)

  function handlePick(emoji) {
    if (selected) return
    setSelected(emoji)
    setTimeout(() => {
      setJoining(true)
      setTimeout(() => onAnswer(emoji), 1000)
    }, 300)
  }

  return (
    <div className="mirror-screen">
      <div className="mirror-glow"     aria-hidden="true" />
      <div className="mirror-stars"    aria-hidden="true" />

      {joining ? (
        <div className="mirror-joining">
          <div className="mirror-join-ring"                aria-hidden="true" />
          <div className="mirror-join-ring mirror-join-ring--2" aria-hidden="true" />
          <span className="mirror-join-emoji" aria-hidden="true">{selected}</span>
          <p className="mirror-join-text">joining people feeling things right now…</p>
        </div>
      ) : (
        <div className="mirror-card">
          <p className="mirror-wordmark" aria-hidden="true">HowAreYou</p>
          <p className="mirror-eyebrow">before you see the world</p>
          <h1 className="mirror-heading">How are you feeling<br />right now?</h1>
          <p className="mirror-sub">Be honest. No one else sees this first.</p>

          <div className="mirror-mood-grid">
            {MOODS.map((emoji, i) => (
              <button
                key={emoji}
                className={[
                  'mirror-mood-btn',
                  selected === emoji              ? 'mirror-mood-btn--active' : '',
                  selected && selected !== emoji  ? 'mirror-mood-btn--faded'  : '',
                ].filter(Boolean).join(' ')}
                style={{ animationDelay: `${i * 0.055}s` }}
                onClick={() => handlePick(emoji)}
                aria-pressed={selected === emoji}
                aria-label={emoji}
                disabled={!!selected}
              >
                {emoji}
              </button>
            ))}
          </div>

          <p className="mirror-hint">Tap how you feel</p>
        </div>
      )}
    </div>
  )
}
