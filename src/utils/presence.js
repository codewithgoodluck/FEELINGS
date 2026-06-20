import {
  doc, setDoc, updateDoc, getDoc,
  collection, query, where,
  onSnapshot, serverTimestamp, increment,
} from 'firebase/firestore'
import { db } from '../firebase'

// Country ISO 3166-1 alpha-2 → flag emoji via regional indicator symbols
export function countryFlag(code) {
  if (!code || code.length !== 2) return '🌍'
  const base = 0x1F1E6 - 65
  return String.fromCodePoint(
    code.toUpperCase().charCodeAt(0) + base,
    code.toUpperCase().charCodeAt(1) + base,
  )
}

async function fetchCountry(lat, lng) {
  if (lat == null || lng == null) return { code: null, name: null }
  try {
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    const res   = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=country&language=en&access_token=${token}`
    )
    const { features } = await res.json()
    const f = features?.[0]
    return {
      code: f?.properties?.short_code?.toUpperCase() ?? null,
      name: f?.place_name ?? null,
    }
  } catch { return { code: null, name: null } }
}

// Called once per session. Creates presence doc on first visit and bumps
// the global totalUsers counter. On return visits just refreshes lastSeen.
export async function initPresence(uid, lat, lng) {
  const presenceRef = doc(db, 'presence', uid)
  const [snap, country] = await Promise.all([
    getDoc(presenceRef),
    fetchCountry(lat, lng),
  ])

  if (!snap.exists()) {
    const statsRef = doc(db, 'stats', 'global')
    try {
      await updateDoc(statsRef, { totalUsers: increment(1) })
    } catch {
      await setDoc(statsRef, { totalUsers: 1 }, { merge: true })
    }
    await setDoc(presenceRef, {
      uid,
      country:     country.code,
      countryName: country.name,
      joinedAt:    serverTimestamp(),
      lastSeen:    serverTimestamp(),
      active:      true,
    })
  } else {
    await updateDoc(presenceRef, {
      country:     country.code  ?? snap.data().country,
      countryName: country.name  ?? snap.data().countryName,
      lastSeen:    serverTimestamp(),
      active:      true,
    })
  }
}

export function heartbeat(uid) {
  return updateDoc(doc(db, 'presence', uid), {
    lastSeen: serverTimestamp(),
    active:   true,
  }).catch(() => {})
}

export function markInactive(uid) {
  return updateDoc(doc(db, 'presence', uid), { active: false })
    .catch(() => {})
}

// Returns all users whose lastSeen is within the last 2 minutes.
// active: true is a pre-filter; client-side timestamp check handles
// cases where markInactive failed on page unload.
export function subscribeToLivePresence(callback) {
  const q = query(collection(db, 'presence'), where('active', '==', true))
  return onSnapshot(q, (snap) => {
    const cutoff = Date.now() - 2 * 60 * 1000
    const live = snap.docs
      .map(d => d.data())
      .filter(p => {
        const ts = p.lastSeen?.toDate?.()?.getTime?.()
          ?? (p.lastSeen?.seconds ? p.lastSeen.seconds * 1000 : 0)
        return ts > cutoff
      })
    callback(live)
  }, err => console.error('subscribeToLivePresence:', err))
}

export function subscribeToTotalUsers(callback) {
  return onSnapshot(
    doc(db, 'stats', 'global'),
    snap => callback(snap.data()?.totalUsers ?? 0),
    err  => console.error('subscribeToTotalUsers:', err),
  )
}
