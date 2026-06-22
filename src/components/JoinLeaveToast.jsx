import { useEffect, useRef, useState } from 'react'

// Reduced-motion detection — constant per page load, no re-render needed
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function JoinLeaveToast({ queue, onDequeue }) {
  const [current, setCurrent] = useState(null)
  const [phase,   setPhase]   = useState('idle') // 'idle' | 'in' | 'out'
  const phaseRef  = useRef('idle') // shadow of phase for effect guard (no stale closure)
  const timerRef  = useRef(null)

  useEffect(() => {
    if (phaseRef.current !== 'idle' || queue.length === 0) return

    const item = queue[0]
    phaseRef.current = 'in'
    setCurrent(item)
    setPhase('in')

    // Stay visible: 2 500ms + animation entry (300ms already baked into CSS)
    const stayMs  = 2500
    const exitMs  = reducedMotion ? 0 : 310

    timerRef.current = setTimeout(() => {
      phaseRef.current = 'out'
      setPhase('out')

      timerRef.current = setTimeout(() => {
        phaseRef.current = 'idle'
        setCurrent(null)
        setPhase('idle')
        onDequeue()
      }, exitMs)
    }, stayMs)
  }, [queue, onDequeue])

  // Cleanup on unmount
  useEffect(() => () => clearTimeout(timerRef.current), [])

  if (phase === 'idle' || !current) return null

  const text = toText(current)

  return (
    <div
      className={`jl-toast jl-toast--${phase}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {text}
    </div>
  )
}

function toText(item) {
  if (item.type === 'burst') return '🌍 Several people just joined'

  const place = item.countryName ? `from ${item.countryName}` : null

  if (item.type === 'join') {
    const flag = item.flag ? `${item.flag} ` : ''
    return place
      ? `🌍 ${flag}Someone ${place} joined`
      : '🌍 Someone joined'
  }

  // leave
  return place
    ? `👋 Someone ${place} left`
    : '👋 Someone left'
}
