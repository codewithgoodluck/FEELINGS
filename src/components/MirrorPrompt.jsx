import { useState } from 'react'

const MOODS = ['😊', '😔', '😤', '😴', '🤔', '🥳', '😰', '😌']

export default function MirrorPrompt({ onAnswer }) {
  const [selected, setSelected] = useState(null)

  function handlePick(emoji) {
    if (selected) return  // prevent double-tap mid-animation
    setSelected(emoji)
    setTimeout(() => onAnswer(emoji), 380)
  }

  return (
    <div className="mirror-screen">
      <div className="mirror-card">
        <p className="mirror-eyebrow">before you see the world</p>
        <h1 className="mirror-heading">How are you feeling right now?</h1>
        <p className="mirror-sub">Be honest. No one else sees this first.</p>

        <div className="mirror-mood-grid">
          {MOODS.map((emoji) => (
            <button
              key={emoji}
              className={[
                'mirror-mood-btn',
                selected === emoji  ? 'mirror-mood-btn--active' : '',
                selected && selected !== emoji ? 'mirror-mood-btn--faded' : '',
              ].join(' ')}
              onClick={() => handlePick(emoji)}
              aria-pressed={selected === emoji}
              disabled={!!selected}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
