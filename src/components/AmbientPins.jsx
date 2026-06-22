import { useMemo } from 'react'

const MAX_AMBIENT = 12
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
  const driftDur = 14 + Math.floor(r[4] * 4) // 14–17 s

  const vw = window.innerWidth
  const vh = window.innerHeight
  // y range for left/right: keep below top 80 px (stat bar) and above bottom 20 px
  const yTop = Math.floor(80 + r[2] * Math.max(0, vh - 100))

  let pos = {}
  let driftClass = 'ambient-drift-up'

  if (zone === 'left') {
    pos = { left: `${Math.floor(r[1] * 50)}px`, top: `${yTop}px` }
  } else if (zone === 'right') {
    pos = { right: `${Math.floor(r[1] * 50)}px`, top: `${yTop}px` }
  } else {
    // Bottom strip — must NOT be in center 60 % of viewport width.
    // Place only in left 18 % or right 18 % to leave the map focus zone clear.
    const xPx = r[3] < 0.5
      ? Math.floor(r[1] * vw * 0.18)
      : Math.floor(vw * 0.82 + r[1] * vw * 0.16)
    pos = { left: `${xPx}px`, top: `${Math.floor(vh - 74 + r[2] * 60)}px` }
    driftClass = 'ambient-drift-side'
  }

  return { pos, driftClass, driftDur, zone }
}

function AmbientPin({ pin }) {
  const { pos, driftClass, driftDur, zone } = useMemo(() => pinLayout(pin.id), [pin.id])
  const text = useMemo(() => shortMsg(pin.message), [pin.message])

  return (
    <div
      className={`ambient-pin ambient-pin--${zone} ${driftClass}`}
      style={{ ...pos, '--drift-dur': `${driftDur}s` }}
      aria-hidden="true"
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

export default function AmbientPins({ pins = [] }) {
  const recent = useMemo(() => {
    return [...pins]
      .sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? (a.createdAt?.seconds ?? 0) * 1000
        const tb = b.createdAt?.toMillis?.() ?? (b.createdAt?.seconds ?? 0) * 1000
        return tb - ta
      })
      .slice(0, MAX_AMBIENT)
  }, [pins])

  if (!recent.length) return null

  return (
    <div className="ambient-layer" aria-hidden="true">
      {recent.map((pin) => (
        <AmbientPin key={pin.id} pin={pin} />
      ))}
    </div>
  )
}
