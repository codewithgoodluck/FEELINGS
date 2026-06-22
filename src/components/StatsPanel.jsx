import { useState, useEffect, useRef } from 'react'
import { subscribeToLivePresence, subscribeToTotalUsers, countryFlag } from '../utils/presence'

function AnimatedNum({ value }) {
  const [display, setDisplay] = useState(value)
  const [flash,   setFlash]   = useState(false)
  const prev = useRef(value)

  useEffect(() => {
    if (value !== prev.current) {
      prev.current = value
      setDisplay(value)
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 500)
      return () => clearTimeout(t)
    }
  }, [value])

  return (
    <span className={`stats-num${flash ? ' stats-num--flash' : ''}`}>
      {typeof display === 'number' ? display.toLocaleString() : display}
    </span>
  )
}

export default function StatsPanel() {
  const [expanded,   setExpanded]   = useState(() => window.innerWidth >= 768)
  const [liveUsers,  setLiveUsers]  = useState(null) // null = loading
  const [totalUsers, setTotalUsers] = useState(0)
  const prevCounts = useRef({})
  const [deltas, setDeltas] = useState({})

  useEffect(() => {
    const u1 = subscribeToLivePresence(setLiveUsers)
    const u2 = subscribeToTotalUsers(setTotalUsers)
    return () => { u1(); u2() }
  }, [])

  // Build per-country breakdown from live users
  const byCountry    = {}
  const countryNames = {}
  ;(liveUsers ?? []).forEach(u => {
    if (!u.country) return
    byCountry[u.country]    = (byCountry[u.country] || 0) + 1
    countryNames[u.country] = u.countryName || u.country
  })
  const sortedCountries = Object.entries(byCountry).sort((a, b) => b[1] - a[1])
  const liveNow         = liveUsers?.length ?? 0
  const uniqueCountries = sortedCountries.length

  // Track per-country deltas for the ↑↓ arrows
  useEffect(() => {
    if (!liveUsers) return
    const next = {}
    sortedCountries.forEach(([code, count]) => {
      const p = prevCounts.current[code]
      if (p !== undefined && count !== p) next[code] = count > p ? 'up' : 'down'
    })
    Object.keys(prevCounts.current).forEach(code => {
      if (!byCountry[code]) next[code] = 'down'
    })
    prevCounts.current = { ...byCountry }
    if (!Object.keys(next).length) return
    setDeltas(next)
    const t = setTimeout(() => setDeltas({}), 3000)
    return () => clearTimeout(t)
  }, [liveUsers]) // eslint-disable-line react-hooks/exhaustive-deps

  const loading = liveUsers === null

  return (
    <div className={`stats-panel${expanded ? ' stats-panel--open' : ''}`}>
      {/* Collapsed toggle — always visible */}
      <button
        className="stats-toggle"
        onClick={() => setExpanded(e => !e)}
        aria-label="Toggle live stats"
        aria-expanded={expanded}
      >
        <span className="stats-dot" aria-hidden="true" />
        <span className="stats-toggle-text">
          {loading ? '…' : liveNow} live
        </span>
        <span className="stats-toggle-chevron" aria-hidden="true">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="stats-body">
          <div className="stats-metrics">
            <div className="stats-metric">
              <AnimatedNum value={totalUsers} />
              <span className="stats-metric-label">total users</span>
            </div>
            <div className="stats-metric">
              <AnimatedNum value={liveNow} />
              <span className="stats-metric-label">live now</span>
            </div>
            <div className="stats-metric">
              <AnimatedNum value={uniqueCountries} />
              <span className="stats-metric-label">countries</span>
            </div>
          </div>

          {sortedCountries.length > 0 && (
            <>
              <div className="stats-sep" />
              <div className="stats-countries" role="list">
                {sortedCountries.map(([code, count]) => (
                  <div key={code} className="stats-country" role="listitem">
                    <span className="stats-country-flag" aria-hidden="true">
                      {countryFlag(code)}
                    </span>
                    <span className="stats-country-name">{countryNames[code]}</span>
                    <span className="stats-country-count">{count}</span>
                    {deltas[code] === 'up'   && <span className="stats-arrow stats-arrow--up"   aria-label="increasing">↑</span>}
                    {deltas[code] === 'down' && <span className="stats-arrow stats-arrow--down" aria-label="decreasing">↓</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
