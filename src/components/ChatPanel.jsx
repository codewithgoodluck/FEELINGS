import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  getOrCreateConversation,
  subscribeToMessages,
  subscribeToConversation,
  subscribeToConversationsForPin,
  sendMessage,
  requestReveal,
  reportPin,
} from '../utils/db'
import { getAnonIdentity, getAnonColour } from '../utils/identity'
import { uploadVoice, getSupportedMimeType } from '../utils/voiceStorage'
import { useAuth } from '../contexts/AuthContext'
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
  const [recording, setRecording]       = useState(false)
  const [seconds, setSeconds]           = useState(0)
  const [blob, setBlob]                 = useState(null)
  const [previewUrl, setPreviewUrl]     = useState(null)
  const [uploading, setUploading]       = useState(false)
  const recorderRef = useRef(null)
  const timerRef    = useRef(null)
  const chunksRef   = useRef([])
  const streamRef   = useRef(null)

  function stopRecording() {
    recorderRef.current?.stop()
    clearInterval(timerRef.current)
    setRecording(false)
  }

  async function startRecording() {
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = getSupportedMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        setBlob(b)
        setPreviewUrl(URL.createObjectURL(b))
        stream.getTracks().forEach((t) => t.stop())
      }
      recorder.start(100)
      recorderRef.current = recorder
      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s >= 9) { stopRecording(); return 10 }
          return s + 1
        })
      }, 1000)
    } catch (err) {
      console.error('Mic access denied:', err)
      alert('Microphone access is needed for voice notes. Please allow it and try again.')
    }
  }

  function cancel() {
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
      await onSend(url)
      cancel()
    } catch (err) {
      console.error('Voice upload failed:', err)
      alert('Failed to send voice note — check your connection.')
    }
    setUploading(false)
  }

  return { recording, seconds, blob, previewUrl, uploading, startRecording, stopRecording, cancel, send }
}

// ── Shared thread UI ──────────────────────────────────────────────────────────

function ConversationThread({ conversationId, pin, user, onBack }) {
  const [messages, setMessages]         = useState([])
  const [conversation, setConversation] = useState(null)
  const [input, setInput]               = useState('')
  const [sending, setSending]           = useState(false)
  const [showGifs, setShowGifs]         = useState(false)
  const [pendingGif, setPendingGif]     = useState(null)
  const bottomRef     = useRef(null)
  const chatBottomRef = useRef(null)
  const isOwn         = user.uid === pin.uid
  const myIdentity = getAnonIdentity(user.uid, pin.country)

  const voice = useVoiceRecorder(async (url) => {
    await sendMessage(conversationId, { uid: user.uid, text: '', voiceUrl: url })
  })

  useEffect(() => {
    markSeen(conversationId)
    const unsubMsg  = subscribeToMessages(conversationId, setMessages)
    const unsubConv = subscribeToConversation(conversationId, setConversation)
    return () => { unsubMsg(); unsubConv() }
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const bothRevealed  = conversation?.revealedBy?.includes(user.uid) && conversation?.revealedBy?.includes(pin.uid)
  const myHasRevealed = conversation?.revealedBy?.includes(user.uid)

  function getDisplayName(uid) {
    if (bothRevealed && conversation?.displayNames?.[uid]) return conversation.displayNames[uid]
    return getAnonIdentity(uid, pin.country)
  }

  const otherUid  = conversation?.participants?.find((p) => p !== user.uid)
  const otherName = otherUid ? getDisplayName(otherUid) : '…'

  async function handleSend() {
    if (!input.trim() && !pendingGif) return
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
  async function handleReveal() {
    await requestReveal(conversationId, user.uid, user.displayName || myIdentity)
  }

  const voiceActive = voice.recording || !!voice.blob

  return (
    <>
      {onBack && <button className="inbox-back-btn" onClick={onBack}>← Inbox</button>}

      {!isOwn && (
        <>
          {!bothRevealed && !myHasRevealed && (
            <button className="btn btn--reveal" onClick={handleReveal} style={{ marginBottom: '0.875rem' }}>
              👋 Reveal who you are
            </button>
          )}
          {!bothRevealed && myHasRevealed && (
            <div className="reveal-bar" style={{ marginBottom: '0.875rem' }}>
              <p className="reveal-waiting">⏳ Waiting for {otherName} to reveal…</p>
            </div>
          )}
          {bothRevealed && (
            <div className="reveal-bar reveal-bar--confirmed" style={{ marginBottom: '0.875rem' }}>
              ✓ You both know each other now
            </div>
          )}
        </>
      )}

      {/* Scrollable messages */}
      <div className="message-list" role="log" aria-live="polite">
        {messages.length === 0 && (
          <p className="empty-state">
            {isOwn ? 'Someone reached out — say hi!' : 'Say hello — they\'re waiting to hear from you.'}
          </p>
        )}
        {messages.map((msg) => {
          const isMe = msg.uid === user.uid
          return (
            <div key={msg.id} className={`message ${isMe ? 'message--mine' : 'message--theirs'}`}>
              <p className="message-sender">{getDisplayName(msg.uid)}</p>
              {msg.voiceUrl ? (
                <div className="message-bubble message-bubble--voice">
                  <audio controls src={msg.voiceUrl} preload="none" className="voice-audio" />
                </div>
              ) : msg.gifUrl ? (
                <div className="message-bubble message-bubble--gif">
                  <img src={msg.gifUrl} alt="GIF" className="message-gif" loading="lazy" />
                </div>
              ) : (
                <div className="message-bubble">{msg.text}</div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

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

      {/* Sticky bottom */}
      <div className="chat-bottom" ref={chatBottomRef}>
        {/* Voice recorder UI */}
        {voiceActive && (
          <div className="voice-bar">
            {voice.recording ? (
              <>
                <span className="voice-recording-dot" aria-hidden="true" />
                <span className="voice-timer">{10 - voice.seconds}s</span>
                <div style={{ flex: 1 }} />
                <button className="btn btn--sm btn--ghost" onClick={voice.cancel}>Cancel</button>
                <button className="btn btn--sm btn--primary" onClick={voice.stopRecording}>Done</button>
              </>
            ) : (
              <>
                <audio controls src={voice.previewUrl} preload="metadata" className="voice-preview-audio" />
                <button className="icon-btn gif-preview-cancel" onClick={voice.cancel} aria-label="Cancel">✕</button>
                <button
                  className="btn btn--send"
                  onClick={voice.send}
                  disabled={voice.uploading}
                  aria-label="Send voice note"
                >
                  {voice.uploading ? '…' : '↑'}
                </button>
              </>
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
              onChange={(e) => !pendingGif && setInput(e.target.value)}
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

// ── Main ChatPanel ────────────────────────────────────────────────────────────

export default function ChatPanel({ pin, onClose }) {
  const { user } = useAuth()
  const [conversationId, setConversationId] = useState(null)
  const [inboxConvId, setInboxConvId]       = useState(null)
  const [connError, setConnError]           = useState(false)
  const [showReport, setShowReport]         = useState(false)
  const isOwn = user.uid === pin.uid

  useEffect(() => {
    if (isOwn || !pin.uid) return
    setConversationId(null)
    setConnError(false)
    getOrCreateConversation(pin.id, user.uid, pin.uid)
      .then(setConversationId)
      .catch((err) => { console.error('Chat init failed:', err); setConnError(true) })
  }, [pin.id, user.uid, pin.uid, isOwn])

  async function handleReport() {
    await reportPin(pin.id, user.uid, 'User report')
    setShowReport(false)
    alert('Thanks — this pin has been reported.')
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
    <div className="panel slide-up chat-panel" role="dialog" aria-label="Conversation">
      <div className="panel-handle" />

      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-avatar" style={{ background: getAnonColour(pin.uid || 'anon') }} aria-hidden="true">
            {pin.mood}
          </div>
          <div>
            <p className="chat-name">{getAnonIdentity(pin.uid, pin.country)}</p>
            <p className="chat-sub">
              {pin.isFlash ? '⚡ Flash pin' : isOwn ? 'Your pin · inbox' : 'Anonymous · tap to chat'}
            </p>
          </div>
        </div>
        <div className="chat-header-actions">
          {!isOwn && (
            <button className="icon-btn" onClick={() => setShowReport(!showReport)} aria-label="Report">⚑</button>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
      </div>

      <div className="privacy-notice" role="note">
        🔒 Stay anonymous — never share your real name, number, or personal details.
      </div>

      <div className="pin-context">
        <span className="pin-mood">{pin.mood}</span>
        <p className="pin-message">{pin.message || 'No message — just a feeling.'}</p>
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
          <ConversationThread conversationId={inboxConvId} pin={pin} user={user} onBack={() => setInboxConvId(null)} />
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
        <ConversationThread conversationId={conversationId} pin={pin} user={user} onBack={null} />
      ) : (
        <div className="empty-state"><p>Connecting…</p></div>
      )}
    </div>
  )
}
