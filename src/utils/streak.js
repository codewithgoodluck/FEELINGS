const KEY = 'hay_streak'

function toDateStr(d) { return d.toISOString().slice(0, 10) }

// Call when user creates a pin. Returns new streak count.
export function recordCheckIn() {
  try {
    const today = toDateStr(new Date())
    const raw   = localStorage.getItem(KEY)
    const { lastDate = null, count = 0 } = raw ? JSON.parse(raw) : {}
    if (lastDate === today) return count   // already checked in today
    const yesterday = toDateStr(new Date(Date.now() - 86_400_000))
    const newCount  = lastDate === yesterday ? count + 1 : 1
    localStorage.setItem(KEY, JSON.stringify({ lastDate: today, count: newCount }))
    return newCount
  } catch { return 0 }
}

export function getStreakCount() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return 0
    const { lastDate = null, count = 0 } = JSON.parse(raw)
    if (!lastDate) return 0
    const today     = toDateStr(new Date())
    const yesterday = toDateStr(new Date(Date.now() - 86_400_000))
    return (lastDate === today || lastDate === yesterday) ? count : 0
  } catch { return 0 }
}
