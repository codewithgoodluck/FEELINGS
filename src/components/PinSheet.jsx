import { useState, useEffect } from 'react'
import { getAnonIdentity } from '../utils/identity'
import { useAuth } from '../contexts/AuthContext'
import { ChatPanelContent } from './ChatPanel'
import { deactivatePin, togglePinReaction } from '../utils/db'
import TranslateButton from './TranslateButton'

const REACTION_EMOJIS = ['💙', '🤝', '❤️']

function PinReactions({ pin, user }) {
  const [reacts, setReacts] = useState(pin.reactions ?? {})
  const uid = user?.uid

  async function handleReact(emoji) {
    if (!uid) return
    const current = reacts[emoji] ?? []
    const mine = current.includes(uid)
    setReacts(prev => ({
      ...prev,
      [emoji]: mine ? current.filter(u => u !== uid) : [...current, uid],
    }))
    try { await togglePinReaction(pin.id, uid, emoji) } catch {}
  }

  const total = Object.values(reacts).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0)

  return (
    <div className="pin-reactions">
      <div className="pin-reactions-btns">
        {REACTION_EMOJIS.map(emoji => {
          const count = (reacts[emoji] ?? []).length
          const mine  = uid && (reacts[emoji] ?? []).includes(uid)
          return (
            <button
              key={emoji}
              className={`pin-reaction-btn${mine ? ' pin-reaction-btn--mine' : ''}`}
              onClick={() => handleReact(emoji)}
              aria-pressed={!!mine}
              aria-label={`React with ${emoji}${count > 0 ? `, ${count}` : ''}`}
            >
              {emoji}
              {count > 0 && <span className="pin-reaction-count">{count}</span>}
            </button>
          )
        })}
      </div>
      {total > 0 && <span className="pin-reactions-total">{total} {total === 1 ? 'reaction' : 'reactions'}</span>}
    </div>
  )
}

const ICEBREAKERS = {
  '😊': "Hey! Looks like today's treating you well — what's good? 🙂",
  '😔': "Hey, rough day? I'm around if you want to talk.",
  '😤': "Sounds like something got to you — want to vent?",
  '😴': "Tired today too? 😴 What's draining you?",
  '🤔': "Hey, what's got you thinking today?",
  '🥳': "Something to celebrate? 🎉 Spill!",
  '😰': "Hey, you've got this 💪 — what's going on?",
  '😌': "Hey, you seem calm today — what's your secret? 😌",
}

function buildIcebreaker(pinMood, myMood) {
  if (pinMood && myMood && pinMood === myMood) {
    return `You're both feeling ${pinMood} today — what's behind it for you?`
  }
  return ICEBREAKERS[pinMood] || `Hey, saw you're feeling ${pinMood || 'something'} today 🙂`
}

export default function PinSheet({ pin, mirrorMood, onClose, onDelete, onBlock }) {
  const { user } = useAuth()
  const [sheetState, setSheetState] = useState('peek')
  const [prefill, setPrefill]       = useState('')
  const [deleting, setDeleting]     = useState(false)
  const isOwn = pin.uid === user?.uid

  async function handleDelete() {
    setDeleting(true)
    try {
      await deactivatePin(pin.id)
      onDelete?.(pin.id)
    } finally {
      setDeleting(false)
    }
  }

  // Reset to peek whenever the pin changes
  useEffect(() => {
    setSheetState('peek')
    setPrefill('')
  }, [pin.id])

  function handleAction() {
    if (!isOwn) setPrefill(buildIcebreaker(pin.mood, mirrorMood))
    setSheetState('full')
  }

  const sheetClass = [
    'hay-pin-sheet',
    sheetState === 'peek' ? 'hay-pin-sheet--peek' : 'hay-pin-sheet--full',
  ].join(' ')

  return (
    <div className={sheetClass} role="dialog" aria-label={sheetState === 'peek' ? 'Pin preview' : 'Conversation'}>
      <div className="hay-sheet-handle" />

      {sheetState === 'peek' ? (
        <div className="hay-sheet-peek-content">
          <div className="hay-sheet-peek-row">
            <div className="hay-sheet-peek-emoji">{pin.mood}</div>
            <div className="hay-sheet-peek-info">
              <p className="hay-sheet-peek-name">{getAnonIdentity(pin.uid, pin.country)}</p>
              <p className="hay-sheet-peek-msg">
                {pin.message || 'No message — just a feeling.'}
                {pin.message && <TranslateButton text={pin.message} />}
              </p>
            </div>
          </div>
          {pin.voiceUrl && (
            <div className="pin-voice-wrap">
              <audio controls src={pin.voiceUrl} className="pin-voice-player" preload="none" />
            </div>
          )}
          {!isOwn && <PinReactions key={pin.id} pin={pin} user={user} />}
          <div className="hay-sheet-peek-actions">
            <button className="btn btn--ghost" onClick={onClose} aria-label="Close">✕</button>
            {isOwn ? (
              <>
                <button
                  className="btn btn--ghost pin-delete-btn"
                  onClick={handleDelete}
                  disabled={deleting}
                  aria-label="Remove your pin"
                >
                  {deleting ? '…' : '🗑'}
                </button>
                <button className="btn btn--primary hay-sheet-action-btn" onClick={handleAction}>
                  📬 See messages
                </button>
              </>
            ) : (
              <button className="btn btn--primary hay-sheet-action-btn" onClick={handleAction}>
                👋 Say hi
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="hay-sheet-full-content">
          <ChatPanelContent
            pin={pin}
            user={user}
            onBack={() => setSheetState('peek')}
            onClose={onClose}
            initialInput={prefill}
            onBlock={onBlock}
          />
        </div>
      )}
    </div>
  )
}
