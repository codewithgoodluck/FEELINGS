import { useState, useEffect } from 'react'

const GIPHY_KEY = import.meta.env.VITE_GIPHY_KEY || 'dc6zaTOxFJmzC'
const BASE = 'https://api.giphy.com/v1/gifs'

function gifThumb(g) {
  return (
    g?.images?.fixed_height_small?.url ||
    g?.images?.fixed_height?.url ||
    g?.images?.preview_gif?.url ||
    ''
  )
}

function gifFull(g) {
  return g?.images?.fixed_height?.url || gifThumb(g)
}

export default function GifPicker({ onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const [gifs, setGifs]     = useState([])
  const [status, setStatus] = useState('loading') // loading | ok | error

  useEffect(() => {
    const t = setTimeout(() => fetchGifs(search), search ? 450 : 0)
    return () => clearTimeout(t)
  }, [search])

  async function fetchGifs(q) {
    setStatus('loading')
    try {
      const url = q
        ? `${BASE}/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=21&rating=g`
        : `${BASE}/trending?api_key=${GIPHY_KEY}&limit=21&rating=g`
      const res  = await fetch(url)
      const json = await res.json()

      if (!res.ok || !Array.isArray(json.data)) {
        console.warn('Giphy response:', json.message || res.status)
        setGifs([])
        setStatus('error')
        return
      }

      const valid = json.data.filter((g) => gifThumb(g))
      setGifs(valid)
      setStatus(valid.length ? 'ok' : 'empty')
    } catch (err) {
      console.error('GIF fetch error:', err)
      setStatus('error')
    }
  }

  return (
    <div className="gif-picker">
      <div className="gif-search-row">
        <input
          className="gif-search-input"
          placeholder="Search GIFs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>

      {status === 'loading' && <p className="gif-empty">Loading…</p>}
      {status === 'error'   && (
        <p className="gif-empty">
          GIFs unavailable — add your free key at{' '}
          <a href="https://developers.giphy.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
            developers.giphy.com
          </a>
          {' '}as <code>VITE_GIPHY_KEY</code> in Vercel settings.
        </p>
      )}
      {status === 'empty'   && <p className="gif-empty">No GIFs found for "{search}"</p>}
      {status === 'ok' && (
        <div className="gif-grid">
          {gifs.map((g) => (
            <button
              key={g.id}
              className="gif-thumb-btn"
              onClick={() => onSelect(gifFull(g))}
              title={g.title}
            >
              <img src={gifThumb(g)} alt={g.title || 'GIF'} className="gif-thumb" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <p className="gif-powered">Powered by GIPHY</p>
    </div>
  )
}
