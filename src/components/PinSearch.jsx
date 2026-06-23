import { useEffect, useMemo, useRef, useState } from 'react'
import { subscribeToPins } from '../utils/db'
import { countryFlag, countryName } from '../utils/presence'

const MAX_RESULTS = 40

const MOOD_LABELS = {
  '😊': 'good',       '😔': 'low',        '😤': 'frustrated', '😴': 'tired',
  '🤔': 'unsure',     '🥳': 'excited',    '😰': 'anxious',    '😌': 'calm',
  '😢': 'sad',        '😡': 'angry',      '🤗': 'grateful',   '🥺': 'tender',
  '😶': 'numb',       '🤩': 'amazed',     '🫶': 'loved',      '🥱': 'bored',
}

function truncate(str, max) {
  if (!str) return ''
  return str.length <= max ? str : str.slice(0, max) + '…'
}

export default function PinSearch({ onClose, onFlyTo }) {
  const [allPins, setAllPins] = useState(null) // null = loading
  const [query, setQuery]     = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    return subscribeToPins(setAllPins)
  }, [])

  const results = useMemo(() => {
    if (!allPins || !query.trim()) return []
    const q = query.trim()
    const ql = q.toLowerCase()
    return allPins.filter((pin) =>
      pin.mood === q ||
      MOOD_LABELS[pin.mood]?.includes(ql) ||
      (pin.message && pin.message.toLowerCase().includes(ql)) ||
      (pin.country && countryName(pin.country)?.toLowerCase().includes(ql))
    ).slice(0, MAX_RESULTS)
  }, [allPins, query])

  function handleView(pin) {
    onFlyTo(pin.lng, pin.lat)
    onClose()
  }

  const isLoading  = allPins === null
  const hasQuery   = query.trim().length > 0
  const showSkeleton = isLoading && hasQuery
  const showEmpty    = !isLoading && hasQuery && results.length === 0
  const showResults  = !isLoading && hasQuery && results.length > 0

  return (
    <div className="pin-search-panel" role="search" aria-label="Search pins">
      {/* Input row */}
      <div className="pin-search-input-row">
        <span className="pin-search-icon" aria-hidden="true">⌕</span>
        <input
          ref={inputRef}
          className="pin-search-input"
          type="search"
          placeholder="Search moods or messages…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search pins by mood or message"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
        />
        <button className="icon-btn pin-search-close" onClick={onClose} aria-label="Close search">✕</button>
      </div>

      {/* Results area */}
      {hasQuery && (
        <div className="pin-search-results" role="list" aria-live="polite" aria-label="Search results">
          {showSkeleton && (
            <>
              <div className="pin-result-skeleton" aria-hidden="true" />
              <div className="pin-result-skeleton pin-result-skeleton--2" aria-hidden="true" />
              <div className="pin-result-skeleton pin-result-skeleton--3" aria-hidden="true" />
            </>
          )}

          {showEmpty && (
            <div className="pin-search-empty" aria-live="polite">
              <span className="pin-search-empty-icon">🌍</span>
              <p className="pin-search-empty-text">
                No pins match <strong>"{truncate(query, 24)}"</strong>
              </p>
            </div>
          )}

          {showResults && results.map((pin) => (
            <div key={pin.id} className="pin-result-card" role="listitem">
              <span className="pin-result-mood" aria-hidden="true">{pin.mood}</span>
              <div className="pin-result-info">
                <p className="pin-result-msg">
                  {pin.message
                    ? truncate(pin.message, 72)
                    : <em className="pin-result-empty-msg">No message</em>}
                </p>
                <p className="pin-result-meta">
                  {pin.country ? `${countryFlag(pin.country)} ${pin.country}` : '🌍'}
                </p>
              </div>
              <button
                className="btn btn--sm btn--ghost pin-result-view"
                onClick={() => handleView(pin)}
                aria-label={`View pin on map: ${pin.mood} ${pin.message || ''}`}
              >
                View on map
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
