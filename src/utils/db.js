import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  setDoc,
  updateDoc,
  getDoc,
} from 'firebase/firestore'
import { db } from '../firebase'

// ─── PINS ────────────────────────────────────────────────────────────────────

// Create a new check-in pin
export async function createPin({ uid, lat, lng, mood, message, verified, country, isFlash, hasStreak }) {
  const ttl       = isFlash ? 60_000 : 24 * 60 * 60 * 1000
  const expiresAt = new Date(Date.now() + ttl)
  const ref = await addDoc(collection(db, 'pins'), {
    uid,
    lat,
    lng,
    mood,
    message,
    verified:  verified  === true,
    country:   country   ?? null,
    isFlash:   isFlash   === true,
    hasStreak: hasStreak === true,
    createdAt: serverTimestamp(),
    expiresAt,
    active: true,
  })
  return ref.id
}

// Subscribe to recent active pins — no composite index needed
export function subscribeToPins(callback) {
  const q = query(
    collection(db, 'pins'),
    orderBy('createdAt', 'desc'),
    limit(500)
  )
  return onSnapshot(q, (snap) => {
    const now = new Date()
    const pins = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((p) => p.active !== false)
      .filter((p) => !p.expiresAt || p.expiresAt.toDate() > now)
    callback(pins)
  }, (err) => {
    console.error('subscribeToPins error:', err)
  })
}

// Deactivate a pin (soft delete — keeps conversation history)
export async function deactivatePin(pinId) {
  await updateDoc(doc(db, 'pins', pinId), { active: false })
}

// Fetch a single pin by ID (works even if active: false, for conversation history)
export async function getPin(pinId) {
  const snap = await getDoc(doc(db, 'pins', pinId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

// ─── CONVERSATIONS ────────────────────────────────────────────────────────────

// Deterministic conversation ID — same two users on the same pin always
// map to the same document, so no query or composite index needed.
export async function getOrCreateConversation(pinId, initiatorUid, pinOwnerUid) {
  const [a, b] = [initiatorUid, pinOwnerUid].sort()
  const convId  = `${pinId}_${a}_${b}`
  const ref     = doc(db, 'conversations', convId)
  const snap    = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      pinId,
      participants: [initiatorUid, pinOwnerUid],
      createdAt:   serverTimestamp(),
      revealedBy:  [],
      displayNames: {},
    })
  }
  return convId
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
  }, (err) => console.error('subscribeToMessages:', err))
}

// Send a message (text, GIF, or voice note)
export async function sendMessage(conversationId, { uid, text, gifUrl, voiceUrl, voiceMime }) {
  const payload = { uid, text: text || '', createdAt: serverTimestamp() }
  if (gifUrl)    payload.gifUrl    = gifUrl
  if (voiceUrl)  payload.voiceUrl  = voiceUrl
  if (voiceMime) payload.voiceMime = voiceMime
  await addDoc(collection(db, 'conversations', conversationId, 'messages'), payload)
  await updateDoc(doc(db, 'conversations', conversationId), {
    lastMessageAt:      serverTimestamp(),
    lastMessageUid:     uid,
    lastMessagePreview: voiceUrl ? '🎙️ Voice note' : gifUrl ? '🖼️ GIF' : (text || '').slice(0, 80),
  })
}

// Write / clear the typing indicator for one participant
export async function setTyping(conversationId, uid, isTyping) {
  await updateDoc(doc(db, 'conversations', conversationId), {
    [`typing.${uid}`]: isTyping,
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
  }, (err) => console.error('subscribeToConversation:', err))
}

// Get all conversations for a pin (for pin owner inbox) — single-field equality, no composite index
export function subscribeToConversationsForPin(pinId, callback) {
  const q = query(
    collection(db, 'conversations'),
    where('pinId', '==', pinId)
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  }, (err) => console.error('subscribeToConversationsForPin:', err))
}

// Get all conversations the user is involved in (for global notifications) — array-contains, no composite index
export function subscribeToUserConversations(uid, callback) {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', uid)
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  }, (err) => console.error('subscribeToUserConversations:', err))
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

export async function reportMessage(conversationId, messageId, reporterUid, reason) {
  await addDoc(collection(db, 'messageReports'), {
    conversationId,
    messageId,
    reporterUid,
    reason,
    createdAt: serverTimestamp(),
  })
}

// Cancel a pending reveal request — removes uid from revealedBy and displayNames.
// Only valid before the other participant has also revealed (callers should check bothRevealed).
export async function unrequestReveal(conversationId, uid) {
  const ref  = doc(db, 'conversations', conversationId)
  const snap = await getDoc(ref)
  const data = snap.data() || {}
  const revealedBy   = (data.revealedBy || []).filter((u) => u !== uid)
  const displayNames = { ...(data.displayNames || {}) }
  delete displayNames[uid]
  await updateDoc(ref, { revealedBy, displayNames })
}

// Writes a single system message marking the mutual reveal. Uses a fixed document ID
// so concurrent calls from both clients are idempotent — no duplicate messages.
export async function addRevealSystemMessage(conversationId) {
  await setDoc(
    doc(db, 'conversations', conversationId, 'messages', '_reveal'),
    {
      uid:       '_system',
      type:      'reveal',
      text:      '🎉 You both revealed — say hello for real!',
      createdAt: serverTimestamp(),
    }
  )
}
