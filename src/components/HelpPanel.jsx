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
    a: 'Tap your pin on the map or find it in the live feed — a 🗑 delete button appears on pins you own.',
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
    a: "Open any pin's chat and tap the ⚑ flag icon. You can also block a user with the 🚫 button in the chat header.",
  },
  {
    q: 'What does Travel mode do?',
    a: "Travel mode temporarily disables the country lock, so you can drop pins wherever you are — useful when you're abroad.",
  },
]

// Country code → { name, line, url }
const CRISIS_LINES = {
  US: { name: 'Suicide & Crisis Lifeline',       line: '988',               url: 'https://988lifeline.org' },
  GB: { name: 'Samaritans',                       line: '116 123',           url: 'https://www.samaritans.org' },
  AU: { name: 'Lifeline Australia',               line: '13 11 14',          url: 'https://www.lifeline.org.au' },
  CA: { name: 'Crisis Services Canada',           line: '1-833-456-4566',    url: 'https://www.crisisservicescanada.ca' },
  IE: { name: 'Samaritans Ireland',               line: '116 123',           url: 'https://www.samaritans.org/ireland' },
  NZ: { name: 'Lifeline New Zealand',             line: '0800 543 354',      url: 'https://www.lifeline.org.nz' },
  DE: { name: 'Telefonseelsorge',                 line: '0800 111 0 111',    url: 'https://www.telefonseelsorge.de' },
  FR: { name: 'Numéro national prévention',       line: '3114',              url: 'https://www.3114.fr' },
  JP: { name: 'Inochi no Denwa',                  line: '0120-783-556',      url: 'https://www.inochinodenwa.org' },
  IN: { name: 'iCall',                            line: '9152987821',        url: 'https://icallhelpline.org' },
  ZA: { name: 'SADAG',                            line: '0800 456 789',      url: 'https://www.sadag.org' },
  BR: { name: 'CVV',                              line: '188',               url: 'https://www.cvv.org.br' },
  MX: { name: 'SAPTEL',                           line: '800 290 0024',      url: 'https://www.saptel.org.mx' },
  SG: { name: 'Samaritans of Singapore',          line: '1767',              url: 'https://www.sos.org.sg' },
  NG: { name: 'SURPIN',                           line: '+234 806 210 6493', url: 'https://surpinng.org' },
  KE: { name: 'Befrienders Kenya',                line: '0800 723 253',      url: 'https://www.befrienderskenya.org' },
  PH: { name: 'Hopeline Philippines',             line: '2919',              url: 'https://www.hopeline-ph.com' },
  KR: { name: 'Korea Suicide Prevention Hotline', line: '1393',              url: 'https://www.spckorea.or.kr' },
  CN: { name: 'Beijing Suicide Research',         line: '010-82951332',      url: null },
  AR: { name: 'Centro de Asistencia al Suicida',  line: '135',               url: 'https://www.cas.org.ar' },
  ES: { name: 'Teléfono de la Esperanza',         line: '717 003 717',       url: 'https://www.telefonodelaesperanza.org' },
  IT: { name: 'Telefono Amico',                   line: '02 2327 2327',      url: 'https://www.telefono-amico.it' },
  PT: { name: 'SOS Voz Amiga',                    line: '213 544 545',       url: 'https://www.sosvozamiga.org' },
  NL: { name: '113 Zelfmoordpreventie',           line: '113',               url: 'https://www.113.nl' },
  SE: { name: 'Mind Självmordslinjen',             line: '90101',             url: 'https://mind.se' },
  NO: { name: 'Mental Helse',                     line: '116 123',           url: 'https://mentalhelse.no' },
  PL: { name: 'Telefon Zaufania',                 line: '116 123',           url: 'https://telefonzaufania.org' },
  RU: { name: 'Телефон доверия',                  line: '8-800-2000-122',    url: null },
  ZW: { name: 'Zimbabwe Friends in Need',         line: '+263 4 793 737',    url: null },
}

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

export default function HelpPanel({ onClose, userCountry }) {
  const [tab, setTab] = useState('how')

  const local = userCountry ? CRISIS_LINES[userCountry.toUpperCase()] : null

  return (
    <div className="panel slide-up help-panel" role="dialog" aria-label="Help">
      <div className="panel-handle" />
      <div className="help-header">
        <h2 className="panel-title">Help</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="help-tabs">
        <button className={`help-tab${tab === 'how'     ? ' help-tab--active' : ''}`} onClick={() => setTab('how')}>How to use</button>
        <button className={`help-tab${tab === 'faq'     ? ' help-tab--active' : ''}`} onClick={() => setTab('faq')}>FAQ</button>
        <button className={`help-tab${tab === 'support' ? ' help-tab--active' : ''}`} onClick={() => setTab('support')}>Crisis support</button>
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
      ) : tab === 'faq' ? (
        <div className="help-faq">
          {FAQ.map((item, i) => <FaqItem key={i} {...item} />)}
        </div>
      ) : (
        <div className="help-support">
          <p className="help-support-intro">
            If you or someone you know is struggling, please reach out.
            Help is available right now, and you're not alone.
          </p>

          {local && (
            <div className="crisis-card crisis-card--local">
              <div className="crisis-card-top">
                <span className="crisis-local-label">In your country</span>
              </div>
              <p className="crisis-card-name">{local.name}</p>
              <a className="crisis-card-line" href={`tel:${local.line.replace(/\s/g,'')}`}>{local.line}</a>
              {local.url && (
                <a className="crisis-card-url" href={local.url} target="_blank" rel="noopener noreferrer">
                  Visit website ↗
                </a>
              )}
            </div>
          )}

          <p className="crisis-section-label">International resources</p>
          <div className="crisis-list">
            {Object.entries(CRISIS_LINES)
              .filter(([code]) => !local || code !== userCountry?.toUpperCase())
              .map(([code, info]) => (
                <div key={code} className="crisis-item">
                  <div className="crisis-item-meta">
                    <span className="crisis-item-name">{info.name}</span>
                    {info.url ? (
                      <a className="crisis-item-line" href={info.url} target="_blank" rel="noopener noreferrer">{info.line} ↗</a>
                    ) : (
                      <span className="crisis-item-line">{info.line}</span>
                    )}
                  </div>
                </div>
              ))}
          </div>

          <div className="crisis-footer">
            <p>More resources worldwide:</p>
            <a
              className="crisis-footer-link"
              href="https://www.befrienders.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              befrienders.org ↗
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
