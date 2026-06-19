import { useState } from 'react'

const FAQ = [
  {
    q: 'Is my exact location shared?',
    a: 'No. Your GPS position is fuzzed by up to 200 metres before saving, so nobody — including us — can pinpoint where you actually are.',
  },
  {
    q: 'How long do pins last?',
    a: 'Regular pins disappear after 24 hours. Flash pins (⚡) vanish in 60 seconds. Nothing is stored permanently.',
  },
  {
    q: 'How do I delete my pin?',
    a: 'Tap your pin to open the chat panel — a ✕ delete button appears on the pin itself. Confirm to remove it immediately.',
  },
  {
    q: 'Are chats really anonymous?',
    a: 'Yes. You appear as a random name like "Amber Owl". No email, phone number, or account is ever required.',
  },
  {
    q: 'How does identity reveal work?',
    a: "Either person can tap \"Reveal who you are\". Your name is only shared once the other person also agrees — it's always mutual.",
  },
  {
    q: 'How do I report inappropriate content?',
    a: 'Open any pin\'s chat panel and tap the ⚑ flag icon in the top right corner. Our team reviews every report.',
  },
]

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`faq-item${open ? ' faq-item--open' : ''}`}>
      <button className="faq-q" onClick={() => setOpen(o => !o)}>
        <span>{q}</span>
        <span className="faq-chevron">{open ? '−' : '+'}</span>
      </button>
      {open && <p className="faq-a">{a}</p>}
    </div>
  )
}

export default function HelpPanel({ onClose }) {
  const [tab, setTab] = useState('how')
  return (
    <div className="panel slide-up help-panel" role="dialog" aria-label="Help">
      <div className="panel-handle" />
      <div className="help-header">
        <h2 className="panel-title">Help</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="help-tabs">
        <button
          className={`help-tab${tab === 'how' ? ' help-tab--active' : ''}`}
          onClick={() => setTab('how')}
        >
          How to use
        </button>
        <button
          className={`help-tab${tab === 'faq' ? ' help-tab--active' : ''}`}
          onClick={() => setTab('faq')}
        >
          FAQ
        </button>
      </div>

      {tab === 'how' ? (
        <div className="help-how">
          <p className="help-section-label">📱 On mobile</p>
          <ul className="help-steps">
            <li><span>🤔</span>Tell us how you're feeling on the opening screen</li>
            <li><span>📍</span>Tap the map or hit + to drop an anonymous mood pin</li>
            <li><span>💬</span>Tap any pin to read it and start an anonymous chat</li>
            <li><span>⚡</span>Use flash mode for a 60-second ephemeral feeling</li>
            <li><span>🔥</span>Check in daily to build a streak — pins get a glow ring</li>
          </ul>
          <p className="help-section-label">🖥 On desktop</p>
          <ul className="help-steps">
            <li><span>🖱</span>Click anywhere on the map to drop a pin</li>
            <li><span>🔍</span>Scroll to zoom in and explore mood clusters</li>
            <li><span>💬</span>Click any pin to open the chat sidebar</li>
            <li><span>🎙</span>Voice notes and GIFs work on desktop too</li>
          </ul>
        </div>
      ) : (
        <div className="help-faq">
          {FAQ.map((item, i) => <FaqItem key={i} {...item} />)}
        </div>
      )}
    </div>
  )
}
