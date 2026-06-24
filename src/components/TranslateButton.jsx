import { useState } from 'react'
import { translateText, getUserLang } from '../utils/translate'

export default function TranslateButton({ text, className = '' }) {
  const [status,     setStatus]     = useState('idle') // idle | loading | done | error
  const [translated, setTranslated] = useState(null)

  const showing = status === 'done' && translated !== null

  async function toggle() {
    if (showing) {
      setTranslated(null)
      setStatus('idle')
      return
    }
    setStatus('loading')
    try {
      const result = await translateText(text, getUserLang())
      setTranslated(result)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return (
    <span className={`translate-wrap${className ? ' ' + className : ''}`}>
      {showing && (
        <span className="translate-output">{translated}</span>
      )}
      <button
        className={`translate-btn${showing ? ' translate-btn--on' : ''}`}
        onClick={toggle}
        disabled={status === 'loading'}
        aria-label={showing ? 'Show original text' : 'Translate'}
        title={showing ? 'Show original' : `Translate to ${getUserLang()}`}
      >
        {status === 'loading' ? '⋯' : showing ? '↩' : '🌐'}
        {status === 'error' && <span className="translate-err"> !</span>}
      </button>
    </span>
  )
}
