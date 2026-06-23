import { useState, useMemo, useRef, useEffect } from 'react'
import { uploadVoice, getSupportedMimeType } from '../utils/voiceStorage'

const PROMPTS = [
  "What's one thing on your mind right now?",
  "What made today feel different?",
  "Is there something you've been holding in?",
  "What are you looking forward to — even something small?",
  "What would help you feel a little better right now?",
  "What's draining you most today?",
  "Is there someone you wish you could talk to?",
  "What's the last thing that made you smile?",
  "What emotion have you been avoiding?",
  "What do you wish people knew about how you're feeling?",
  "What's one thing that went okay today?",
  "What are you proud of, even if it feels small?",
  "What are you afraid to say out loud?",
  "Is there something you need to let go of?",
  "What's been surprising about today?",
  "What would make tomorrow a little easier?",
  "What are you grateful for right now?",
  "What's weighing on you most?",
  "What do you need but haven't asked for?",
  "What's one kind thing you could do for yourself today?",
  "What feeling keeps coming back?",
  "What's something you're still figuring out?",
  "What do you wish someone would ask you?",
  "What's hard to admit right now?",
  "What are you hoping for?",
  "What's been on replay in your head?",
  "What do you need more of right now?",
  "What's one thing that brought you comfort lately?",
  "What are you ready to move on from?",
  "How have you been treating yourself today?",
]

const MOODS = [
  { emoji: '😊', label: 'Good' },
  { emoji: '😔', label: 'Low' },
  { emoji: '😤', label: 'Frustrated' },
  { emoji: '😴', label: 'Tired' },
  { emoji: '🤔', label: 'Unsure' },
  { emoji: '🥳', label: 'Excited' },
  { emoji: '😰', label: 'Anxious' },
  { emoji: '😌', label: 'Calm' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '😡', label: 'Angry' },
  { emoji: '🤗', label: 'Grateful' },
  { emoji: '🥺', label: 'Tender' },
  { emoji: '😶', label: 'Numb' },
  { emoji: '🤩', label: 'Amazed' },
  { emoji: '🫶', label: 'Loved' },
  { emoji: '🥱', label: 'Bored' },
]

export default function CheckInPanel({ location, onSubmit, onClose, initialMood, placeName, statusMsg }) {
  const [selectedMood, setSelectedMood] = useState(
    initialMood ? (MOODS.find((m) => m.emoji === initialMood) ?? null) : null
  )
  const [message, setMessage]       = useState('')
  const [isFlash, setIsFlash]       = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')
  const [voiceBlob, setVoiceBlob]   = useState(null)
  const [recording, setRecording]   = useState(false)
  const recorderRef = useRef(null)
  const chunksRef   = useRef([])

  useEffect(() => () => { recorderRef.current?.stop(); recorderRef.current = null }, [])

  const todayPrompt = useMemo(() => {
    const dayIndex = Math.floor(Date.now() / 86400000) % PROMPTS.length
    return PROMPTS[dayIndex]
  }, [])

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime   = getSupportedMimeType()
      const rec    = new MediaRecorder(stream, mime ? { mimeType: mime } : {})
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data?.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        setVoiceBlob(new Blob(chunksRef.current, { type: mime || 'audio/webm' }))
        stream.getTracks().forEach(t => t.stop())
      }
      rec.start()
      recorderRef.current = rec
      setRecording(true)
    } catch {}
  }

  function stopRecording() {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
  }

  async function handleSubmit() {
    if (!selectedMood) return
    setSubmitting(true)
    setError('')
    try {
      let voiceUrl = null
      if (voiceBlob) voiceUrl = await uploadVoice(voiceBlob)
      await onSubmit({ mood: selectedMood.emoji, message: message.trim(), isFlash, voiceUrl })
    } catch (err) {
      setError(err?.message || 'Failed to post. Check your connection.')
      setSubmitting(false)
    }
  }

  return (
    <div className="panel slide-up checkin-panel" role="dialog" aria-label="Post a check-in">
      <div className="panel-handle" />

      {/* Scrollable content area */}
      <div className="checkin-scroll">

        {/* Flash / Normal toggle */}
        <div className="pin-type-row">
          <button
            className={`pin-type-btn${!isFlash ? ' pin-type-btn--active' : ''}`}
            onClick={() => setIsFlash(false)}
          >
            📍 24h pin
          </button>
          <button
            className={`pin-type-btn${isFlash ? ' pin-type-btn--active' : ''}`}
            onClick={() => setIsFlash(true)}
          >
            ⚡ 60s flash
          </button>
        </div>

        <h2 className="panel-title">How are you doing?</h2>
        {placeName && (
          <p className="checkin-location-label">📍 Near {placeName}</p>
        )}
        <p className={`panel-sub${isFlash ? ' panel-sub--flash' : ''}`}>
          {isFlash
            ? '⚡ Vanishes in 60 seconds — say it and let it go.'
            : 'Your pin disappears in 24 hours.'}
        </p>

        <div className="mood-grid" role="group" aria-label="Choose your mood">
          {MOODS.map((m) => (
            <button
              key={m.emoji}
              className={`mood-btn${selectedMood?.emoji === m.emoji ? ' mood-btn--active' : ''}`}
              onClick={() => setSelectedMood(m)}
              aria-pressed={selectedMood?.emoji === m.emoji}
            >
              <span className="mood-emoji">{m.emoji}</span>
              <span className="mood-label">{m.label}</span>
            </button>
          ))}
        </div>

        {/* Status message pre-fill */}
        {!message && statusMsg && (
          <button
            className="checkin-prompt checkin-prompt--status"
            onClick={() => setMessage(statusMsg + ' ')}
            aria-label="Use your status message"
          >
            <span className="checkin-prompt-label">Your status</span>
            <span className="checkin-prompt-text">"{statusMsg}"</span>
            <span className="checkin-prompt-cta">Tap to use →</span>
          </button>
        )}

        {/* Daily prompt suggestion */}
        {!message && !statusMsg && (
          <button
            className="checkin-prompt"
            onClick={() => setMessage(todayPrompt + ' ')}
            aria-label="Use today's prompt"
          >
            <span className="checkin-prompt-label">Today's prompt</span>
            <span className="checkin-prompt-text">"{todayPrompt}"</span>
            <span className="checkin-prompt-cta">Tap to use →</span>
          </button>
        )}

        {/* Voice check-in */}
        <div className="checkin-voice">
          {!voiceBlob ? (
            <button
              type="button"
              className={`checkin-voice-btn${recording ? ' checkin-voice-btn--rec' : ''}`}
              onClick={recording ? stopRecording : startRecording}
              aria-label={recording ? 'Stop recording' : 'Add a voice note'}
            >
              <span className="checkin-voice-icon">{recording ? '⏹' : '🎙'}</span>
              {recording ? 'Tap to stop' : 'Voice note'}
            </button>
          ) : (
            <div className="checkin-voice-preview">
              <audio src={URL.createObjectURL(voiceBlob)} controls className="checkin-voice-audio" />
              <button type="button" className="checkin-voice-clear" onClick={() => setVoiceBlob(null)} aria-label="Remove recording">✕</button>
            </div>
          )}
        </div>

        <textarea
          className="check-in-text"
          placeholder="Say a bit more… (optional)"
          maxLength={280}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-label="Optional message"
        />
        <p className="char-count">{message.length}/280</p>

        <p className="privacy-notice" role="note">
          🔒 Keep it anonymous — don't share personal details.
        </p>

        {error && <p className="checkin-error">{error}</p>}
      </div>

      {/* Sticky footer — always visible */}
      <div className="checkin-footer">
        <button className="btn btn--ghost" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button
          className={`btn${isFlash ? ' btn--flash' : ' btn--primary'}`}
          onClick={handleSubmit}
          disabled={!selectedMood || submitting}
        >
          {submitting ? 'Posting…' : isFlash ? '⚡ Flash it' : 'Drop pin'}
        </button>
      </div>
    </div>
  )
}
