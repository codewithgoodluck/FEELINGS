import { useState, useRef } from 'react'

const SLIDES = [
  {
    emoji: '👋',
    title: 'Welcome to HowAreYou',
    body: "A living map of feelings. See how people around the world are really doing — and share how you're doing too.",
  },
  {
    emoji: '📍',
    title: 'Drop a pin',
    body: "Tap the map or hit + to share your mood. Your location is always approximate — never exact.",
  },
  {
    emoji: '🌍',
    title: 'Explore the world',
    body: 'Zoom out to see mood clusters across neighbourhoods. Zoom in to discover individual check-ins near you.',
  },
  {
    emoji: '💬',
    title: 'Chat anonymously',
    body: 'Tap any pin to open a conversation. You appear as a random name like "Amber Owl" — no account needed.',
  },
  {
    emoji: '🤝',
    title: 'Reveal when ready',
    body: "If a chat feels right, both of you can choose to share who you are. It's always mutual — never automatic.",
  },
]

export default function OnboardingTour({ onDone, onDropPin }) {
  const [index, setIndex] = useState(0)
  const touchStartX = useRef(null)
  const isLast = index === SLIDES.length - 1
  const slide  = SLIDES[index]

  function next() { if (!isLast) setIndex(i => i + 1) }
  function prev() { if (index > 0) setIndex(i => i - 1) }

  function finish() {
    localStorage.setItem('feelin_onboarded', '1')
    onDone()
  }

  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev()
    touchStartX.current = null
  }

  return (
    <div className="onboarding-screen" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="onboarding-card">
        <button className="onboarding-skip" onClick={finish}>Skip</button>
        <span className="onboarding-emoji" key={index}>{slide.emoji}</span>
        <h1 className="onboarding-title">{slide.title}</h1>
        <p className="onboarding-body">{slide.body}</p>
        <div className="onboarding-dots">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={`onboarding-dot${i === index ? ' onboarding-dot--active' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
        {isLast ? (
          <div className="onboarding-cta-group">
            <button
              className="btn btn--primary btn--full"
              onClick={() => { finish(); onDropPin() }}
            >
              📍 Drop my first pin
            </button>
            <button className="btn btn--ghost btn--full" onClick={finish}>
              Explore first
            </button>
          </div>
        ) : (
          <button className="btn btn--primary btn--full" onClick={next}>
            Next →
          </button>
        )}
      </div>
    </div>
  )
}
