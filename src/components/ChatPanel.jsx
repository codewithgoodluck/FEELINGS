import { useEffect, useRef, useState } from 'react'
import {
  getOrCreateConversation,
  subscribeToMessages,
  subscribeToConversation,
  sendMessage,
  requestReveal,
  reportPin,
} from '../utils/db'
import { getAnonIdentity, getAnonColour } from '../utils/identity'
import { useAuth } from '../contexts/AuthContext'

export default function ChatPanel({ pin, onClose }) {
  const { user } = useAuth()
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [conversation, setConversation] = useState(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const bottomRef = useRef(null)

  const myIdentity = getAnonIdentity(user.uid)
  const isOwn = user.uid === pin.uid

  useEffect(() => {
    if (isOwn) return
    getOrCreateConversation(pin.id, user.uid, pin.uid).then(setConversationId)
  }, [pin.id, user.uid, pin.uid, isOwn])

  useEffect(() => {
    if (!conversationId) return
    const unsubMsg = subscribeToMessages(conversationId, setMessages)
    const unsubConv = subscribeToConversation(conversationId, setConversation)
    return () => { unsubMsg(); unsubConv() }
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || !conversationId) return
    setSending(true)
    await sendMessage(conversationId, { uid: user.uid, text: input.trim() })
    setInput('')
    setSending(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const bothRevealed =
    conversation?.revealedBy?.includes(user.uid) &&
    conversation?.revealedBy?.includes(pin.uid)

  const myHasRevealed = conversation?.revealedBy?.includes(user.uid)

  function getDisplayName(uid) {
    if (bothRevealed && conversation?.displayNames?.[uid]) {
      return conversation.displayNames[uid]
    }
    return getAnonIdentity(uid)
  }

  function getInitials(name) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  async function handleReveal() {
    if (!conversationId) return
    await requestReveal(conversationId, user.uid, user.displayName || myIdentity)
  }

  async function handleReport() {
    await reportPin(pin.id, user.uid, 'User report')
    setShowReport(false)
    alert('Thanks — this pin has been reported.')
  }

  const pinOwnerName = getDisplayName(pin.uid)

  return (
    <div className="panel slide-up chat-panel" role="dialog" aria-label="Conversation">
      <div className="panel-handle" />

      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <div
            className="chat-avatar"
            style={{ background: bothRevealed ? getAnonColour(pin.uid) : getAnonColour(pin.uid) }}
            aria-hidden="true"
          >
            {bothRevealed ? getInitials(pinOwnerName) : pin.mood}
          </div>
          <div>
            <p className="chat-name">{pinOwnerName}</p>
            <p className={bothRevealed ? 'chat-sub chat-sub--revealed' : 'chat-sub'}>
              {isOwn
                ? 'Your pin'
                : bothRevealed
                  ? '✓ Identity revealed'
                  : 'Anonymous · tap a pin to chat'}
            </p>
          </div>
        </div>
        <div className="chat-header-actions">
          {!isOwn && (
            <button
              className="icon-btn"
              onClick={() => setShowReport(!showReport)}
              aria-label="Report this pin"
            >
              ⚑
            </button>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Close chat">
            ✕
          </button>
        </div>
      </div>

      {/* Reveal button — PROMINENT, at top, 3 states */}
      {!isOwn && (
        <>
          {!bothRevealed && !myHasRevealed && (
            <button className="btn btn--reveal" onClick={handleReveal} style={{ marginBottom: '0.875rem' }}>
              👋 Reveal who you are
            </button>
          )}
          {!bothRevealed && myHasRevealed && (
            <div className="reveal-bar" style={{ marginBottom: '0.875rem' }}>
              <p className="reveal-waiting">
                ⏳ Waiting for {pinOwnerName} to reveal…
              </p>
            </div>
          )}
          {bothRevealed && (
            <div className="reveal-bar reveal-bar--confirmed" style={{ marginBottom: '0.875rem' }}>
              ✓ You both know each other now
            </div>
          )}
        </>
      )}

      {/* Pin context */}
      <div className="pin-context">
        <span className="pin-mood">{pin.mood}</span>
        <p className="pin-message">{pin.message || 'No message — just a feeling.'}</p>
      </div>

      {/* Report bar */}
      {showReport && (
        <div className="report-bar">
          <p>Report this pin as inappropriate?</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn--ghost btn--sm" onClick={() => setShowReport(false)}>Cancel</button>
            <button className="btn btn--danger btn--sm" onClick={handleReport}>Report</button>
          </div>
        </div>
      )}

      {/* Own pin */}
      {isOwn ? (
        <div className="empty-state">
          <p>This is your pin.<br />Wait for someone to reach out ✨</p>
        </div>
      ) : (
        <>
          <div className="message-list" role="log" aria-live="polite">
            {messages.length === 0 && (
              <p className="empty-state">Say hello — they're waiting to hear from you.</p>
            )}
            {messages.map((msg) => {
              const isMe = msg.uid === user.uid
              return (
                <div
                  key={msg.id}
                  className={`message ${isMe ? 'message--mine' : 'message--theirs'}`}
                >
                  <p className="message-sender">{getDisplayName(msg.uid)}</p>
                  <div className="message-bubble">{msg.text}</div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-row">
            <textarea
              className="chat-input"
              placeholder="Say something…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={500}
              aria-label="Type a message"
            />
            <button
              className="btn btn--send"
              onClick={handleSend}
              disabled={!input.trim() || sending}
              aria-label="Send message"
            >
              ↑
            </button>
          </div>
        </>
      )}
    </div>
  )
}
