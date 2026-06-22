import { useEffect, useMemo, useState } from 'react'
import { subscribeToPins } from '../utils/db'

const MAX_AMBIENT = 10
const ZONES = ['left', 'right', 'bottom']

// Deterministic pseudo-random values seeded by pin ID — stable across re-renders
function seedRands(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  h = Math.abs(h)
  return Array.from({ length: 5 }, (_, i) => {
    const x = Math.sin((h + i) * 9301.2) * 49297
    return x - Math.floor(x)
  })
}

function shortMsg(msg) {
  if (!msg) return ''
  const words = msg.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  return words.length <= 2 ? words.join(' ') : words.slice(0, 2).join(' ') + '…'
}

function pinLayout(id) {
  const r = seedRands(id)
  const zone = ZONES[Math.floor(r[0] * 3)]
  const driftDur = 12 + Math.floor(r[4] * 6) // 12–17 s

  let pos = {}
  let driftClass = 'ambient-drift-up'

  if (zone === 'left') {
    pos = { left: `max(4px, ${1 + r[1] * 3}vw)`, top: `${20 + r[2] * 52}vh` }
  } else if (zone === 'right') {
    pos = { right: `max(4px, ${1 + r[1] * 3}vw)`, top: `${20 + r[2] * 52}vh` }
  } else {
    // bottom strip — avoid far edges so pill is fully visible
    pos = { left: `${12 + r[1] * 60}%`, top: `${80 + r[2] * 7}vh` }
    driftClass = 'ambient-drift-side'
  }

  return { pos, driftClass, driftDur }
}

function AmbientPin({ pin }) {
  const { pos, driftClass, driftDur } = useMemo(() => pinLayout(pin.id), [pin.id])
  const text = useMemo(() => shortMsg(pin.message), [pin.message])

  return (
    <div
      className={`ambient-pin ${driftClass}`}
      style={{ ...pos, '--drift-dur': `${driftDur}s` }}
    >
      {text ? (
        <span className="ambient-pill">
          <span className="ambient-emoji">{pin.mood}</span>
          <span className="ambient-text">{text}</span>
        </span>
      ) : (
        <span className="ambient-emoji-only">{pin.mood}</span>
      )}
    </div>
  )
}

export default function AmbientPins() {
  const [pins, setPins] = useState([])

  useEffect(() => subscribeToPins((all) => setPins(all.slice(0, MAX_AMBIENT))), [])

  if (!pins.length) return null

  return (
    <div className="ambient-layer" aria-hidden="true">
      {pins.map((pin) => (
        <AmbientPin key={pin.id} pin={pin} />
      ))}
    </div>
  )
}
