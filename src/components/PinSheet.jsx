import { useState, useEffect } from 'react'
import { getAnonIdentity } from '../utils/identity'
import { useAuth } from '../contexts/AuthContext'
import { ChatPanelContent } from './ChatPanel'
import { deactivatePin } from '../utils/db'

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
              <p className="hay-sheet-peek-msg">{pin.message || 'No message — just a feeling.'}</p>
            </div>
          </div>
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
