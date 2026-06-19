import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore'
import { db } from '../firebase'

// ─── PINS ────────────────────────────────────────────────────────────────────

// Create a new check-in pin
export async function createPin({ uid, lat, lng, mood, message }) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h from now
  const ref = await addDoc(collection(db, 'pins'), {
    uid,
    lat,
    lng,
    mood,
    message,
    createdAt: serverTimestamp(),
    expiresAt,
    active: true,
  })
  return ref.id
}

// Subscribe to all active pins within map bounds (called on every map move)
// bounds = { north, south, east, west }
export function subscribeToPins(bounds, callback) {
  const q = query(
    collection(db, 'pins'),
    where('active', '==', true),
    where('lat', '>=', bounds.south),
    where('lat', '<=', bounds.north)
  )
  return onSnapshot(q, (snap) => {
    const pins = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      // Filter east/west in JS (Firestore only supports one range filter)
      .filter((p) => p.lng >= bounds.west && p.lng <= bounds.east)
      // Filter out expired pins client-side
      .filter((p) => p.expiresAt?.toDate() > new Date())
    callback(pins)
  })
}

// Deactivate a pin (soft delete — keeps conversation history)
export async function deactivatePin(pinId) {
  await updateDoc(doc(db, 'pins', pinId), { active: false })
}

// ─── CONVERSATIONS ────────────────────────────────────────────────────────────

// Start or get a conversation between two users about a pin
export async function getOrCreateConversation(pinId, initiatorUid, pinOwnerUid) {
  const q = query(
    collection(db, 'conversations'),
    where('pinId', '==', pinId),
    where('participants', 'array-contains', initiatorUid)
  )
  const existing = await getDocs(q)
  if (!existing.empty) return existing.docs[0].id

  const ref = await addDoc(collection(db, 'conversations'), {
    pinId,
    participants: [initiatorUid, pinOwnerUid],
    createdAt: serverTimestamp(),
    // Reveal state: null = anonymous, uid = that user revealed themselves
    revealedBy: [],
    // If both reveal, store actual display names here
    displayNames: {},
  })
  return ref.id
}

// Subscribe to messages in a conversation
export function subscribeToMessages(conversationId, callback) {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'asc')
  )
  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    callback(messages)
  })
}

// Send a message
export async function sendMessage(conversationId, { uid, text }) {
  await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
    uid,
    text,
    createdAt: serverTimestamp(),
  })
}

// Request identity reveal
export async function requestReveal(conversationId, uid, displayName) {
  const ref = doc(db, 'conversations', conversationId)
  const snap = await getDoc(ref)
  const data = snap.data()

  const revealedBy = [...(data.revealedBy || []), uid]
  const displayNames = { ...(data.displayNames || {}), [uid]: displayName }

  await updateDoc(ref, { revealedBy, displayNames })
}

// Subscribe to a conversation's metadata (for reveal state changes)
export function subscribeToConversation(conversationId, callback) {
  return onSnapshot(doc(db, 'conversations', conversationId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() })
  })
}

// ─── REPORTS ─────────────────────────────────────────────────────────────────

export async function reportPin(pinId, reporterUid, reason) {
  await addDoc(collection(db, 'reports'), {
    pinId,
    reporterUid,
    reason,
    createdAt: serverTimestamp(),
  })
}
