const KEY = 'hay_blocked_uids'

export function getBlockedUids() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')) } catch { return new Set() }
}

export function blockUser(uid) {
  const uids = getBlockedUids()
  uids.add(uid)
  localStorage.setItem(KEY, JSON.stringify([...uids]))
}

export function unblockUser(uid) {
  const uids = getBlockedUids()
  uids.delete(uid)
  localStorage.setItem(KEY, JSON.stringify([...uids]))
}
