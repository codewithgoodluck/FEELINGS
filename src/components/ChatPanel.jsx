import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  getOrCreateConversation,
  subscribeToMessages,
  subscribeToConversation,
  subscribeToConversationsForPin,
  sendMessage,
  requestReveal,
  unrequestReveal,
  addRevealSystemMessage,
  reportPin,
  reportMessage,
  setTyping,
  markConversationSeen,
  toggleReaction,
} from '../utils/db'
import { getAnonIdentity, getAnonColour } from '../utils/identity'
import { uploadVoice, getSupportedMimeType } from '../utils/voiceStorage'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import GifPicker from './GifPicker'

function markSeen(convId) {
  try { localStorage.setItem('hay_seen_' + convId, Date.now()) } catch {}
}
function lastSeen(convId) {
  try { return parseInt(localStorage.getItem('hay_seen_' + convId) || '0', 10) } catch { return 0 }
}
function isUnread(conv, myUid) {
  if (!conv.lastMessageAt) return false
  const ts = conv.lastMessageAt?.seconds
    ? conv.lastMessageAt.seconds * 1000
    : conv.lastMessageAt?.toDate?.()?.getTime?.() ?? 0
  return ts > lastSeen(conv.id) && conv.lastMessageUid !== myUid
}

// ── Voice recorder hook ───────────────────────────────────────────────────────

function useVoiceRecorder(onSend) {
  const showToast = useToast()
  const [recording, setRecording]       = useState(false)
  const [seconds, setSeconds]           = useState(0)
  const [blob, setBlob]                 = useState(null)
  const [previewUrl, setPreviewUrl]     = useState(null)
  const [uploading, setUploading]       = useState(false)
  const recorderRef   = useRef(null)
  const timerRef      = useRef(null)
  const chunksRef     = useRef([])
  const streamRef     = useRef(null)
  const cancelledRef  = useRef(false)

  function stopRecording() {
    recorderRef.current?.stop()
    recorderRef.current = null
    clearInterval(timerRef.current)
    setRecording(false)
  }

  async function startRecording() {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      showToast('Voice notes are not supported in this browser. Try Chrome or Firefox.', 'error')
      return
    }
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = getSupportedMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      cancelledRef.current = false
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        setRecording(false)
        if (cancelledRef.current) return
        const b = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        setBlob(b)
        setPreviewUrl(URL.createObjectURL(b))
      }
      recorder.start(100)
      recorderRef.current = recorder
      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1)
      }, 1000)
    } catch (err) {
      console.error('Mic access denied:', err)
      showToast('Microphone access is needed for voice notes. Please allow it and try again.', 'error')
    }
  }

  useEffect(() => {
    if (seconds >= 10) stopRecording()
  }, [seconds])

  function cancel() {
    cancelledRef.current = true
    stopRecording()
    setBlob(null)
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }
    setSeconds(0)
  }

  async function send() {
    if (!blob) return
    setUploading(true)
    try {
      const url = await uploadVoice(blob)
      await onSend(url, blob.type || 'audio/webm')
      cancel()
    } catch (err) {
      console.error('Voice upload failed:', err, err?.code, err?.message)
      showToast(`Failed to send voice note — ${err?.message || 'check your connection'}.`, 'error')
    }
    setUploading(false)
  }

  return { recording, seconds, blob, previewUrl, uploading, startRecording, stopRecording, cancel, send }
}

// ── Voice UI helpers ──────────────────────────────────────────────────────────

// circumference of r=16 SVG circle
const RING_CIRC = 2 * Math.PI * 16

const AUTH_ERROR_MSGS = {
  EMAIL_IN_USE:      'This email is already registered. Try the Log in tab.',
  INVALID_EMAIL:     'Please enter a valid email address.',
  WEAK_PASSWORD:     'Password must be at least 6 characters.',
  WRONG_CREDENTIALS: 'Incorrect email or password.',
  TOO_MANY_REQUESTS: 'Too many attempts — try again in a moment.',
  NETWORK_ERROR:     'Connection error — check your network.',
  UNKNOWN:           'Something went wrong. Please try again.',
}

function seededHeight(seed, i) {
  const x = Math.sin((seed + i) * 9301.2) * 93701
  return 4 + ((x - Math.floor(x)) * 16)
}

function fmtDuration(s) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function RecordingWaveform() {
  const [heights, setHeights] = useState(
    () => Array.from({ length: 14 }, () => 4 + Math.random() * 22)
  )
  useEffect(() => {
    const id = setInterval(() => {
      setHeights(Array.from({ length: 14 }, () => 4 + Math.random() * 22))
    }, 140)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="voice-rec-wave" aria-hidden="true">
      {heights.map((h, i) => (
        <span key={i} className="voice-rec-bar" style={{ height: `${h}px` }} />
      ))}
    </div>
  )
}

function VoicePreview({ previewUrl, onCancel, onSend, uploading }) {
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef(null)
  const bars = useMemo(
    () => Array.from({ length: 22 }, (_, i) => seededHeight(42, i)),
    []
  )
  function toggle() {
    const a = audioRef.current
    if (!a) return
    playing ? a.pause() : a.play()
  }
  return (
    <>
      <audio
        ref={audioRef}
        src={previewUrl}
        style={{ display: 'none' }}
        preload="metadata"
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <button
        className="voice-play-btn"
        onClick={toggle}
        aria-label={playing ? 'Pause preview' : 'Play preview'}
      >
        {playing ? '⏸' : '▶'}
      </button>
      <div className="voice-waveform" aria-hidden="true">
        {bars.map((h, i) => <span key={i} className="voice-wf-bar" style={{ height: `${h}px` }} />)}
      </div>
      <span className="voice-dur">{duration > 0 && isFinite(duration) ? fmtDuration(duration) : '—'}</span>
      <button className="icon-btn gif-preview-cancel" onClick={onCancel} aria-label="Cancel">✕</button>
      <button className="btn btn--send" onClick={onSend} disabled={uploading} aria-label="Send voice note">
        {uploading ? '…' : '↑'}
      </button>
    </>
  )
}

function VoicePlayer({ src, mime, isMe, msgId }) {
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef(null)
  const seed = useMemo(() => {
    let h = 0
    for (let i = 0; i < msgId.length; i++) h = (h * 31 + msgId.charCodeAt(i)) | 0
    return Math.abs(h)
  }, [msgId])
  const bars = useMemo(
    () => Array.from({ length: 22 }, (_, i) => seededHeight(seed, i)),
    [seed]
  )
  function toggle(e) {
    e.stopPropagation()
    const a = audioRef.current
    if (!a) return
    playing ? a.pause() : a.play()
  }
  return (
    <div className={`voice-bubble${isMe ? ' voice-bubble--mine' : ''}`}>
      <audio
        ref={audioRef}
        style={{ display: 'none' }}
        preload="metadata"
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      >
        <source src={src} {...(mime ? { type: mime } : {})} />
      </audio>
      <button
        className="voice-play-btn"
        onClick={toggle}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
      >
        {playing ? '⏸' : '▶'}
      </button>
      <div className="voice-waveform" aria-hidden="true">
        {bars.map((h, i) => <span key={i} className="voice-wf-bar" style={{ height: `${h}px` }} />)}
      </div>
      <span className="voice-dur">
        {duration > 0 && isFinite(duration) ? fmtDuration(duration) : '—'}
      </span>
    </div>
  )
}

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

// ── Shared thread UI ──────────────────────────────────────────────────────────

function ConversationThread({ conversationId, pin, user, onBack, initialInput }) {
  const [messages, setMessages]         = useState([])
  const [conversation, setConversation] = useState(null)
  const [input, setInput]               = useState(initialInput || '')
  const [sending, setSending]           = useState(false)
  const [showGifs, setShowGifs]         = useState(false)
  const [pendingGif, setPendingGif]     = useState(null)
  const [newMsgIds, setNewMsgIds]       = useState(() => new Set())
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const bottomRef        = useRef(null)
  const chatBottomRef    = useRef(null)
  const msgListRef       = useRef(null)
  const initialLoadRef   = useRef(false)
  const knownIdsRef      = useRef(new Set())
  const isOwn         = user.uid === pin.uid
  const myIdentity    = getAnonIdentity(user.uid, pin.country)
  const { registerAccount, loginAccount } = useAuth()

  const [chatTip, setChatTip] = useState(
    () => !isOwn && localStorage.getItem('feelin_tip_chat') !== '1'
  )
  function dismissChatTip() {
    localStorage.setItem('feelin_tip_chat', '1')
    setChatTip(false)
  }

  const [privacyNote, setPrivacyNote] = useState(
    () => !isOwn && localStorage.getItem('feelin_seen_privacy_note') !== '1'
  )
  function dismissPrivacyNote() {
    localStorage.setItem('feelin_seen_privacy_note', '1')
    setPrivacyNote(false)
  }

  const [expandedMsgId, setExpandedMsgId] = useState(null)
  const typingTimerRef = useRef(null)
  const isTypingRef    = useRef(false)

  // Reveal flow state
  const [revealStep, setRevealStep]           = useState(null) // null | 'auth-gate' | 'name-choice'
  const [authTab, setAuthTab]                 = useState('signup')
  const [authEmail, setAuthEmail]             = useState('')
  const [authPassword, setAuthPassword]       = useState('')
  const [authError, setAuthError]             = useState(null)
  const [authLoading, setAuthLoading]         = useState(false)
  const [revealName, setRevealName]           = useState('')
  const [revealNameError, setRevealNameError] = useState(null)
  const [showCelebration, setShowCelebration] = useState(false)
  const conversationLoadedRef = useRef(false)
  const prevBothRevealedRef   = useRef(false)
  const celebrationTimerRef   = useRef(null)

  function formatTime(msg) {
    const ts = msg.createdAt?.toDate?.()
            ?? (msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000) : null)
    if (!ts) return ''
    return ts.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  function notifyTyping() {
    if (!conversationId) return
    if (!isTypingRef.current) {
      isTypingRef.current = true
      setTyping(conversationId, user.uid, true).catch(() => {})
    }
    clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false
      setTyping(conversationId, user.uid, false).catch(() => {})
    }, 2000)
  }

  function clearTyping() {
    clearTimeout(typingTimerRef.current)
    if (isTypingRef.current && conversationId) {
      isTypingRef.current = false
      setTyping(conversationId, user.uid, false).catch(() => {})
    }
  }

  // Clear typing status when component unmounts or conversation changes
  useEffect(() => () => clearTyping(), [conversationId]) // eslint-disable-line

  // Clear pending timer refs on unmount
  useEffect(() => () => {
    clearTimeout(longPressTimerRef.current)
    clearTimeout(actionDismissRef.current)
    clearTimeout(celebrationTimerRef.current)
  }, [])

  const voice = useVoiceRecorder(async (url, mime) => {
    await sendMessage(conversationId, { uid: user.uid, text: '', voiceUrl: url, voiceMime: mime })
  })

  useEffect(() => {
    initialLoadRef.current = false
    knownIdsRef.current    = new Set()
    markSeen(conversationId)
    markConversationSeen(conversationId, user.uid)
    const unsubMsg = subscribeToMessages(conversationId, (incoming) => {
      if (!initialLoadRef.current) {
        // First snapshot — populate known IDs, no animation
        initialLoadRef.current = true
        knownIdsRef.current = new Set(incoming.map((m) => m.id))
        setMessages(incoming)
        return
      }
      // Subsequent snapshots — detect genuinely new messages
      const fresh = incoming.filter((m) => !knownIdsRef.current.has(m.id) && m.uid !== user.uid)
      fresh.forEach((m) => knownIdsRef.current.add(m.id))
      incoming.forEach((m) => knownIdsRef.current.add(m.id))
      setMessages(incoming)
      // Update seenBy whenever new messages arrive while chat is open
      if (fresh.length > 0) markConversationSeen(conversationId, user.uid)
      if (fresh.length === 0) return
      // Animate new incoming messages
      setNewMsgIds((prev) => {
        const next = new Set([...prev, ...fresh.map((m) => m.id)])
        return next
      })
      setTimeout(() => {
        setNewMsgIds((prev) => {
          const next = new Set(prev)
          fresh.forEach((m) => next.delete(m.id))
          return next
        })
      }, 500)
      // Show scroll button if user is not near the bottom
      const el = msgListRef.current
      if (el) {
        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
        if (distFromBottom > 80) setShowScrollBtn(true)
      }
    })
    const unsubConv = subscribeToConversation(conversationId, setConversation)
    return () => { unsubMsg(); unsubConv() }
  }, [conversationId]) // eslint-disable-line

  // Auto-scroll to bottom only when the user is already near the bottom
  useEffect(() => {
    const el = msgListRef.current
    if (!el) { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); return }
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distFromBottom < 80) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setShowScrollBtn(false)
    }
  }, [messages])

  const bothRevealed  = conversation?.revealedBy?.includes(user.uid) && conversation?.revealedBy?.includes(pin.uid)
  const myHasRevealed = conversation?.revealedBy?.includes(user.uid)

  // Fire celebration overlay exactly once when bothRevealed first transitions false→true in this session.
  // Seeds refs on first conversation load to avoid replaying celebration on re-open.
  useEffect(() => {
    if (!conversation) return
    if (!conversationLoadedRef.current) {
      conversationLoadedRef.current = true
      prevBothRevealedRef.current = !!bothRevealed
      return
    }
    if (bothRevealed && !prevBothRevealedRef.current) {
      setShowCelebration(true)
      addRevealSystemMessage(conversationId).catch(() => {})
      celebrationTimerRef.current = setTimeout(() => setShowCelebration(false), 2600)
    }
    prevBothRevealedRef.current = !!bothRevealed
  }, [bothRevealed, conversation]) // eslint-disable-line

  function getDisplayName(uid) {
    if (bothRevealed && conversation?.displayNames?.[uid]) return conversation.displayNames[uid]
    return getAnonIdentity(uid, pin.country)
  }

  const otherUid  = conversation?.participants?.find((p) => p !== user.uid)
  const otherName = otherUid ? getDisplayName(otherUid) : '…'

  async function handleSend() {
    if (!input.trim() && !pendingGif) return
    clearTyping()
    setSending(true)
    try {
      if (pendingGif) {
        await sendMessage(conversationId, { uid: user.uid, text: '', gifUrl: pendingGif })
        setPendingGif(null)
      } else {
        await sendMessage(conversationId, { uid: user.uid, text: input.trim() })
        setInput('')
      }
    } catch (err) { console.error('sendMessage failed:', err) }
    setSending(false)
  }

  function handleGifSelect(url) { setPendingGif(url); setShowGifs(false) }
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }
  const showToast = useToast()

  function handleRevealCta() {
    if (user.isAnonymous) {
      setRevealStep('auth-gate')
    } else {
      setRevealStep('name-choice')
    }
  }

  async function handleAuthSubmit() {
    setAuthLoading(true)
    setAuthError(null)
    const result = authTab === 'signup'
      ? await registerAccount(authEmail.trim(), authPassword)
      : await loginAccount(authEmail.trim(), authPassword)
    setAuthLoading(false)
    if (result.error) { setAuthError(result.error); return }
    setAuthEmail('')
    setAuthPassword('')
    setRevealStep('name-choice')
  }

  async function handleConfirmReveal() {
    const name = revealName.trim()
    if (!name) { setRevealNameError('Please enter a name.'); return }
    setRevealStep(null)
    setRevealName('')
    await requestReveal(conversationId, user.uid, name).catch((err) => {
      console.error('requestReveal failed:', err)
      showToast('Could not send reveal — try again.', 'error')
    })
  }

  async function handleCancelReveal() {
    await unrequestReveal(conversationId, user.uid).catch((err) => {
      console.error('unrequestReveal failed:', err)
    })
  }

  const [actionPopId, setActionPopId] = useState(null)
  const longPressTimerRef = useRef(null)
  const didLongPressRef   = useRef(false)
  const actionDismissRef  = useRef(null)

  function openActionPop(msgId) {
    setActionPopId(msgId)
    clearTimeout(actionDismissRef.current)
    actionDismissRef.current = setTimeout(() => setActionPopId(null), 4000)
  }

  function startLongPress(msgId) {
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true
      openActionPop(msgId)
    }, 480)
  }

  function cancelLongPress() {
    clearTimeout(longPressTimerRef.current)
  }

  async function handleReact(msgId, emoji) {
    setActionPopId(null)
    clearTimeout(actionDismissRef.current)
    try {
      await toggleReaction(conversationId, msgId, user.uid, emoji)
    } catch (err) { console.error('toggleReaction failed:', err) }
  }

  async function handleReportMessage(msgId) {
    setActionPopId(null)
    clearTimeout(actionDismissRef.current)
    try {
      await reportMessage(conversationId, msgId, user.uid, 'User report')
      showToast('Message reported.', 'success')
    } catch (err) {
      console.error('reportMessage failed:', err)
      showToast('Could not report — try again.', 'error')
    }
  }

  const voiceActive = voice.recording || !!voice.blob

  return (
    <>
      {onBack && <button className="inbox-back-btn" onClick={onBack}>← Inbox</button>}

      {/* Context bar: mood + truncated message + reveal pill */}
      <div className="chat-context-bar">
        <span className="chat-ctx-mood">{pin.mood}</span>
        <p className="chat-ctx-msg">{pin.message || 'No message — just a feeling.'}</p>
        {!isOwn && (
          bothRevealed ? (
            <span className="chat-ctx-pill chat-ctx-pill--done">✓ Revealed</span>
          ) : myHasRevealed ? (
            <span className="chat-ctx-pill chat-ctx-pill--waiting">
              ⏳ Waiting…
              <button className="chat-ctx-cancel-reveal" onClick={handleCancelReveal}>cancel</button>
            </span>
          ) : (
            <button className="chat-ctx-pill chat-ctx-pill--cta" onClick={handleRevealCta}>👋 Reveal</button>
          )
        )}
      </div>

      {/* Scrollable messages */}
      <div ref={msgListRef} className="message-list" role="log" aria-live="polite" onClick={(e) => { if (!e.target.closest('.reaction-picker')) setActionPopId(null) }}>
        {privacyNote && (
          <div className="chat-privacy-note">
            <span>🔒 Stay anonymous — never share personal details</span>
            <button onClick={dismissPrivacyNote} aria-label="Dismiss">✕</button>
          </div>
        )}
        {messages.length === 0 && (
          <p className="empty-state">
            {isOwn ? 'Someone reached out — say hi!' : 'Say hello — they\'re waiting to hear from you.'}
          </p>
        )}
        {/* Group consecutive messages from the same sender */}
        {(() => {
          const groups = []
          messages.forEach((msg) => {
            const last = groups[groups.length - 1]
            if (last && last[0].uid === msg.uid) last.push(msg)
            else groups.push([msg])
          })
          // Index of the last group sent by the current user (for seen indicator)
          const lastMyGroupIdx = groups.reduce((acc, g, i) =>
            g[0].uid === user.uid ? i : acc, -1)
          // Timestamp when the other participant last opened the conversation
          const otherSeenAtMs = (() => {
            const ts = conversation?.seenBy?.[otherUid]
            if (!ts) return 0
            return ts.seconds ? ts.seconds * 1000 : ts?.toDate?.()?.getTime?.() ?? 0
          })()
          return groups.map((group, idx) => {
            if (group[0].uid === '_system') {
              return (
                <p key={group[0].id + '-g'} className="system-msg-row">{group[0].text}</p>
              )
            }
            const isMe  = group[0].uid === user.uid
            const multi = group.length > 1
            const isLastMyGroup = isMe && idx === lastMyGroupIdx
            // "Seen" = other person's seenBy timestamp is >= the last msg in group
            const lastMsgMs = (() => {
              const ts = group[group.length - 1].createdAt
              if (!ts) return 0
              return ts.seconds ? ts.seconds * 1000 : ts?.toDate?.()?.getTime?.() ?? 0
            })()
            const isSeen = otherSeenAtMs > 0 && lastMsgMs > 0 && otherSeenAtMs >= lastMsgMs
            return (
              <div
                key={group[0].id + '-g'}
                className={`msg-group ${isMe ? 'msg-group--mine' : 'msg-group--theirs'}`}
              >
                <p className="message-sender">{getDisplayName(group[0].uid)}</p>
                {group.map((msg, mi) => {
                  const isFirst = mi === 0
                  const isLast  = mi === group.length - 1
                  const grpMod  = multi
                    ? isFirst ? 'msg-grp-first' : isLast ? 'msg-grp-last' : 'msg-grp-mid'
                    : ''
                  const bubbleClass = [
                    'message-bubble',
                    msg.voiceUrl ? 'message-bubble--voice' : '',
                    msg.gifUrl   ? 'message-bubble--gif'   : '',
                    grpMod,
                  ].filter(Boolean).join(' ')
                  const msgReactions = Object.entries(msg.reactions ?? {})
                    .filter(([, uids]) => uids.length > 0)
                  return (
                    <div key={msg.id} className={`message ${isMe ? 'message--mine' : 'message--theirs'}${newMsgIds.has(msg.id) ? ' msg-new' : ''}`}>
                      {/* Reaction / report picker — appears on long-press */}
                      {actionPopId === msg.id && (
                        <div className={`reaction-picker${isMe ? ' reaction-picker--mine' : ''}`} onClick={e => e.stopPropagation()}>
                          {REACTIONS.map((emoji) => {
                            const reacted = (msg.reactions?.[emoji] ?? []).includes(user.uid)
                            return (
                              <button
                                key={emoji}
                                className={`reaction-pick-btn${reacted ? ' reaction-pick-btn--active' : ''}`}
                                onClick={() => handleReact(msg.id, emoji)}
                                aria-label={`React with ${emoji}`}
                              >{emoji}</button>
                            )
                          })}
                          {!isMe && (
                            <button className="reaction-pick-report" onClick={() => handleReportMessage(msg.id)} aria-label="Report message">⚑</button>
                          )}
                        </div>
                      )}
                      <div
                        className={bubbleClass}
                        onClick={() => {
                          if (didLongPressRef.current) { didLongPressRef.current = false; return }
                          setExpandedMsgId(id => id === msg.id ? null : msg.id)
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setExpandedMsgId(id => id === msg.id ? null : msg.id)}
                        aria-label="Toggle timestamp"
                        onMouseDown={() => startLongPress(msg.id)}
                        onMouseUp={cancelLongPress}
                        onMouseLeave={cancelLongPress}
                        onTouchStart={() => startLongPress(msg.id)}
                        onTouchEnd={cancelLongPress}
                        onTouchCancel={cancelLongPress}
                      >
                        {msg.voiceUrl ? (
                          <VoicePlayer src={msg.voiceUrl} mime={msg.voiceMime} isMe={isMe} msgId={msg.id} />
                        ) : msg.gifUrl ? (
                          <img src={msg.gifUrl} alt="GIF" className="message-gif" loading="lazy" />
                        ) : (
                          msg.text
                        )}
                      </div>
                      {/* Reaction pills */}
                      {msgReactions.length > 0 && (
                        <div className={`reaction-pills${isMe ? ' reaction-pills--mine' : ''}`}>
                          {msgReactions.map(([emoji, uids]) => (
                            <button
                              key={emoji}
                              className={`reaction-pill${uids.includes(user.uid) ? ' reaction-pill--mine' : ''}`}
                              onClick={() => handleReact(msg.id, emoji)}
                              aria-label={`${emoji} ${uids.length}`}
                            >
                              {emoji} <span className="reaction-count">{uids.length}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {expandedMsgId === msg.id && (
                        <p className="msg-time">{formatTime(msg)}</p>
                      )}
                    </div>
                  )
                })}
                {isLastMyGroup && (
                  <p className={`msg-status${isSeen ? ' msg-status--seen' : ''}`}>
                    {isSeen ? '✓✓ Seen' : '✓ Sent'}
                  </p>
                )}
              </div>
            )
          })
        })()}
        {/* Typing indicator */}
        {otherUid && conversation?.typing?.[otherUid] && (
          <div className="typing-bubble" aria-label="Other person is typing" aria-live="polite">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* One-time chat tip */}
      {chatTip && messages.length === 0 && (
        <div className="chat-tip" onClick={dismissChatTip}>
          <span>💬 Messages are anonymous — say hello!</span>
          <button className="map-tooltip-close" onClick={dismissChatTip} aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* GIF picker — portal so it floats above keyboard without clipping the input row */}
      {showGifs && !voiceActive && createPortal(
        <div
          className="gif-portal"
          style={{ bottom: `calc(var(--vv-bottom, 0px) + ${chatBottomRef.current?.offsetHeight ?? 72}px)` }}
        >
          <GifPicker onSelect={handleGifSelect} onClose={() => setShowGifs(false)} />
        </div>,
        document.body
      )}

      {/* ── Reveal: auth-gate overlay ── */}
      {revealStep === 'auth-gate' && (
        <div className="reveal-overlay" role="dialog" aria-label="Create account to reveal">
          <div className="reveal-sheet">
            <button className="reveal-sheet-close" onClick={() => setRevealStep(null)} aria-label="Close">✕</button>
            <p className="reveal-sheet-eyebrow">👋 Reveal your name</p>
            <h2 className="reveal-sheet-title">Save your profile first</h2>
            <p className="reveal-sheet-sub">Your pins, streak, and history carry over — nothing is lost.</p>
            <div className="reveal-auth-tabs" role="tablist">
              <button role="tab" aria-selected={authTab === 'signup'} className={`reveal-auth-tab${authTab === 'signup' ? ' reveal-auth-tab--active' : ''}`} onClick={() => { setAuthTab('signup'); setAuthError(null) }}>Sign up</button>
              <button role="tab" aria-selected={authTab === 'login'}  className={`reveal-auth-tab${authTab === 'login'  ? ' reveal-auth-tab--active' : ''}`} onClick={() => { setAuthTab('login');  setAuthError(null) }}>Log in</button>
            </div>
            <div className="reveal-auth-form">
              {authError && (
                <p className="reveal-auth-error">
                  {AUTH_ERROR_MSGS[authError] ?? AUTH_ERROR_MSGS.UNKNOWN}
                  {authError === 'EMAIL_IN_USE' && (
                    <button className="reveal-auth-error-switch" onClick={() => { setAuthTab('login'); setAuthError(null) }}>Switch to Log in →</button>
                  )}
                </p>
              )}
              <input className="reveal-auth-input" type="email" placeholder="Email address" value={authEmail} onChange={(e) => { setAuthEmail(e.target.value); setAuthError(null) }} autoComplete="email" inputMode="email" />
              <input className="reveal-auth-input" type="password" placeholder="Password" value={authPassword} onChange={(e) => { setAuthPassword(e.target.value); setAuthError(null) }} autoComplete={authTab === 'signup' ? 'new-password' : 'current-password'} />
              <button className="btn btn--primary btn--full" onClick={handleAuthSubmit} disabled={authLoading || !authEmail.trim() || !authPassword}>
                {authLoading ? '…' : authTab === 'signup' ? 'Create account & continue' : 'Log in & continue'}
              </button>
            </div>
            <button className="reveal-maybe-later" onClick={() => setRevealStep(null)}>Maybe later</button>
          </div>
        </div>
      )}

      {/* ── Reveal: name-choice overlay ── */}
      {revealStep === 'name-choice' && (
        <div className="reveal-overlay" role="dialog" aria-label="Choose your reveal name">
          <div className="reveal-sheet">
            <button className="reveal-sheet-close" onClick={() => setRevealStep(null)} aria-label="Close">✕</button>
            <p className="reveal-sheet-eyebrow">👋 Almost there</p>
            <h2 className="reveal-sheet-title">What should we call you?</h2>
            <p className="reveal-sheet-sub">Only your chosen name is shared — never your email, location, or contact info.</p>
            <div className="reveal-auth-form">
              {revealNameError && <p className="reveal-auth-error">{revealNameError}</p>}
              <input className="reveal-auth-input" type="text" placeholder="Your first name or nickname" value={revealName} onChange={(e) => { setRevealName(e.target.value); setRevealNameError(null) }} maxLength={40} autoComplete="off" autoFocus />
              <button className="btn btn--primary btn--full" onClick={handleConfirmReveal} disabled={!revealName.trim()}>
                Send reveal request
              </button>
            </div>
            <button className="reveal-maybe-later" onClick={() => setRevealStep(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Reveal: mutual celebration overlay ── */}
      {showCelebration && (
        <div className="reveal-celebration" aria-live="assertive" aria-atomic="true">
          <div className="reveal-celeb-avatars">
            <div className="reveal-celeb-avatar" style={{ background: getAnonColour(user.uid) }}>
              {getDisplayName(user.uid).charAt(0).toUpperCase()}
            </div>
            <div className="reveal-celeb-avatar" style={{ background: getAnonColour(otherUid || '') }}>
              {getDisplayName(otherUid || '').charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="reveal-celeb-names">
            <span>{getDisplayName(user.uid)}</span>
            <span className="reveal-celeb-amp">&amp;</span>
            <span>{getDisplayName(otherUid || '')}</span>
          </div>
          <p className="reveal-celeb-note">You both revealed 🎉</p>
        </div>
      )}

      {/* New-message scroll button */}
      {showScrollBtn && (
        <button
          className="chat-scroll-btn"
          onClick={() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
            setShowScrollBtn(false)
          }}
        >
          ↓ New message
        </button>
      )}

      {/* Sticky bottom */}
      <div className="chat-bottom" ref={chatBottomRef}>
        {/* Voice recorder UI */}
        {voiceActive && (
          <div className="voice-bar">
            {voice.recording ? (
              <>
                <div className="voice-rec-ring">
                  <svg viewBox="0 0 38 38" aria-hidden="true">
                    <circle className="voice-rec-ring-bg" cx="19" cy="19" r="16" />
                    <circle
                      className="voice-rec-ring-fg"
                      cx="19" cy="19" r="16"
                      strokeDasharray={RING_CIRC}
                      strokeDashoffset={RING_CIRC * (voice.seconds / 10)}
                    />
                  </svg>
                  <span className="voice-rec-num" aria-live="polite">{10 - voice.seconds}</span>
                </div>
                <RecordingWaveform />
                <button className="btn btn--sm btn--ghost" onClick={voice.cancel}>Cancel</button>
                <button className="btn btn--sm btn--primary" onClick={voice.stopRecording}>Done</button>
              </>
            ) : (
              <VoicePreview
                previewUrl={voice.previewUrl}
                onCancel={voice.cancel}
                onSend={voice.send}
                uploading={voice.uploading}
              />
            )}
          </div>
        )}

        {/* Pending GIF preview */}
        {pendingGif && !voiceActive && (
          <div className="gif-preview-bar">
            <img src={pendingGif} alt="Selected GIF" className="gif-preview-img" />
            <button className="gif-preview-cancel icon-btn" onClick={() => setPendingGif(null)} aria-label="Remove GIF">✕</button>
          </div>
        )}

        {/* Input row — hidden while voice UI is active */}
        {!voiceActive && (
          <div className="chat-input-row">
            <button
              className={`icon-btn gif-toggle-btn${showGifs ? ' gif-toggle-btn--active' : ''}`}
              onClick={() => { setPendingGif(null); setShowGifs(!showGifs) }}
              aria-label="Send a GIF"
              aria-pressed={showGifs}
            >
              GIF
            </button>
            <button
              className="icon-btn voice-btn"
              onClick={voice.startRecording}
              aria-label="Record a voice note"
              title="Record voice note"
            >
              🎙
            </button>
            <textarea
              className="chat-input"
              placeholder={pendingGif ? 'GIF ready — hit send' : 'Say something…'}
              value={pendingGif ? '' : input}
              onChange={(e) => { if (!pendingGif) { setInput(e.target.value); notifyTyping() } }}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={500}
              readOnly={!!pendingGif}
              aria-label="Type a message"
            />
            <button
              className="btn btn--send"
              onClick={handleSend}
              disabled={(!input.trim() && !pendingGif) || sending}
              aria-label="Send message"
            >
              ↑
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Pin owner inbox ───────────────────────────────────────────────────────────

function PinInbox({ pin, user, onSelectConv }) {
  const [convs, setConvs] = useState([])

  useEffect(() => {
    return subscribeToConversationsForPin(pin.id, setConvs)
  }, [pin.id])

  if (convs.length === 0) {
    return (
      <div className="empty-state">
        <p>No messages yet.<br />Wait for someone to reach out ✨</p>
      </div>
    )
  }

  return (
    <div className="conv-list">
      {convs.map((conv) => {
        const otherUid  = conv.participants?.find((p) => p !== user.uid)
        const otherName = otherUid ? getAnonIdentity(otherUid, pin.country) : 'Someone'
        const unread    = isUnread(conv, user.uid)
        const preview   = conv.lastMessagePreview || 'Started a conversation'
        return (
          <button
            key={conv.id}
            className={`conv-item ${unread ? 'conv-item--unread' : ''}`}
            onClick={() => onSelectConv(conv.id)}
          >
            <div className="conv-avatar" style={{ background: otherUid ? getAnonColour(otherUid) : '#555' }}>
              {pin.mood}
            </div>
            <div className="conv-info">
              <p className="conv-name">{otherName}</p>
              <p className="conv-preview">{preview}</p>
            </div>
            {unread && <div className="conv-unread-dot" aria-label="Unread" />}
          </button>
        )
      })}
    </div>
  )
}

// ── Shared panel body — used by ChatPanel (InboxSheet path) and PinSheet ─────

export function ChatPanelContent({ pin, user, onBack, onClose, initialInput }) {
  const [conversationId, setConversationId] = useState(null)
  const [inboxConvId, setInboxConvId]       = useState(null)
  const [connError, setConnError]           = useState(false)
  const [showReport, setShowReport]         = useState(false)
  const [isActive, setIsActive]             = useState(false)
  const isOwn = user.uid === pin.uid

  useEffect(() => {
    if (isOwn || !pin.uid) return
    const presRef = doc(db, 'presence', pin.uid)
    return onSnapshot(presRef, (snap) => {
      const data = snap.data()
      if (!data) { setIsActive(false); return }
      const ts = data.lastSeen?.toDate?.()?.getTime?.()
              ?? (data.lastSeen?.seconds ? data.lastSeen.seconds * 1000 : 0)
      setIsActive(Date.now() - ts < 2 * 60 * 1000)
    })
  }, [pin.uid, isOwn])

  useEffect(() => {
    if (isOwn || !pin.uid) return
    setConversationId(null)
    setConnError(false)
    getOrCreateConversation(pin.id, user.uid, pin.uid)
      .then(setConversationId)
      .catch((err) => { console.error('Chat init failed:', err); setConnError(true) })
  }, [pin.id, user.uid, pin.uid, isOwn])

  const showToastOuter = useToast()

  async function handleReport() {
    await reportPin(pin.id, user.uid, 'User report')
    setShowReport(false)
    showToastOuter('Thanks — this pin has been reported.', 'success')
  }

  function retry() {
    setConnError(false)
    getOrCreateConversation(pin.id, user.uid, pin.uid)
      .then(setConversationId)
      .catch(() => setConnError(true))
  }

  const activeConvId = isOwn ? inboxConvId : conversationId
  const showThread   = !!activeConvId

  return (
    <div className="chat-panel-body">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          {onBack && (
            <button className="chat-back-btn" onClick={onBack} aria-label="Back to pin">←</button>
          )}
          <div className="chat-avatar" style={{ background: getAnonColour(pin.uid || 'anon') }} aria-hidden="true">
            {pin.mood}
          </div>
          <div>
            <p className="chat-name">{getAnonIdentity(pin.uid, pin.country)}</p>
            {!isOwn && isActive ? (
              <p className="chat-sub chat-sub--active">
                <span className="online-dot" aria-hidden="true" />Active now
              </p>
            ) : (
              <p className="chat-sub">
                {pin.isFlash ? '⚡ Flash pin' : isOwn ? 'Your pin · inbox' : 'Anonymous · tap to chat'}
              </p>
            )}
          </div>
        </div>
        <div className="chat-header-actions">
          {!isOwn && (
            <button className="icon-btn" onClick={() => setShowReport(!showReport)} aria-label="Report">⚑</button>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
      </div>

      {showReport && (
        <div className="report-bar">
          <p>Report this pin as inappropriate?</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn--ghost btn--sm" onClick={() => setShowReport(false)}>Cancel</button>
            <button className="btn btn--danger btn--sm" onClick={handleReport}>Report</button>
          </div>
        </div>
      )}

      {/* Content */}
      {isOwn ? (
        showThread ? (
          <ConversationThread conversationId={inboxConvId} pin={pin} user={user} onBack={() => setInboxConvId(null)} initialInput="" />
        ) : (
          <PinInbox pin={pin} user={user} onSelectConv={setInboxConvId} />
        )
      ) : !pin.uid ? (
        <div className="empty-state"><p>This pin can't receive messages.</p></div>
      ) : connError ? (
        <div className="empty-state" style={{ flexDirection: 'column', gap: '12px' }}>
          <p>Couldn't connect — check your internet and try again.</p>
          <button className="btn btn--ghost btn--sm" onClick={retry}>Retry</button>
        </div>
      ) : showThread ? (
        <ConversationThread conversationId={conversationId} pin={pin} user={user} onBack={null} initialInput={initialInput || ''} />
      ) : (
        <div className="empty-state"><p>Connecting…</p></div>
      )}
    </div>
  )
}

// ── Main ChatPanel — used from InboxSheet (direct-to-chat path) ───────────────

export default function ChatPanel({ pin, onClose }) {
  const { user } = useAuth()
  return (
    <div className="panel slide-up chat-panel" role="dialog" aria-label="Conversation">
      <div className="panel-handle" />
      <ChatPanelContent pin={pin} user={user} onBack={null} onClose={onClose} initialInput="" />
    </div>
  )
}
