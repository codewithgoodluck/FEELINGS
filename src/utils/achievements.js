const KEY       = 'hay_achievements'
const COUNT_KEY = 'hay_total_checkins'

export const ACHIEVEMENTS = [
  { id: 'first_pin',   emoji: '🌍', label: 'First feeling',  desc: 'Dropped your first pin' },
  { id: 'ten_pins',    emoji: '🌟', label: 'Regular',        desc: '10 check-ins total' },
  { id: 'streak_5',    emoji: '🔥', label: 'On a roll',      desc: '5-day check-in streak' },
  { id: 'streak_7',    emoji: '💫', label: 'On fire',        desc: '7-day check-in streak' },
  { id: 'first_chat',  emoji: '💬', label: 'Ice breaker',    desc: 'Started your first conversation' },
  { id: 'sos_support', emoji: '❤️', label: 'Helper',         desc: 'Sent support to someone in need' },
]

export function getUnlocked() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')) } catch { return new Set() }
}

export function unlock(id) {
  const unlocked = getUnlocked()
  if (unlocked.has(id)) return false
  unlocked.add(id)
  localStorage.setItem(KEY, JSON.stringify([...unlocked]))
  return true
}

export function getCheckInCount() {
  return parseInt(localStorage.getItem(COUNT_KEY) || '0', 10)
}

export function recordCheckInAchievements(streakCount) {
  const count = getCheckInCount() + 1
  localStorage.setItem(COUNT_KEY, String(count))
  const newly = []
  if (unlock('first_pin'))                     newly.push('first_pin')
  if (count >= 10 && unlock('ten_pins'))       newly.push('ten_pins')
  if (streakCount >= 5 && unlock('streak_5')) newly.push('streak_5')
  if (streakCount >= 7 && unlock('streak_7')) newly.push('streak_7')
  return newly
}
