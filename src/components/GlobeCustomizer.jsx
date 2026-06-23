import { useEffect, useRef } from 'react'
import { GLOBE_STYLES } from '../utils/globeStyles'

export default function GlobeCustomizer({ currentStyleId, onStyleChange, showHeatmap, onHeatmapToggle, onClose }) {
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    setTimeout(() => document.addEventListener('pointerdown', handleClick), 0)
    return () => document.removeEventListener('pointerdown', handleClick)
  }, [onClose])

  return (
    <div className="globe-customizer" ref={ref} role="dialog" aria-label="Globe style">
      <div className="globe-customizer-header">
        <span className="globe-customizer-title">Globe style</span>
        <button className="icon-btn icon-btn--sm" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="globe-customizer-grid">
        {GLOBE_STYLES.map(style => {
          const active = currentStyleId === style.id
          return (
            <button
              key={style.id}
              className={`globe-style-card${active ? ' globe-style-card--active' : ''}`}
              onClick={() => onStyleChange(style)}
              aria-pressed={active}
              title={style.desc}
            >
              <div
                className="globe-style-preview"
                style={{ background: style.preview }}
                aria-hidden="true"
              >
                <span className="globe-style-globe">🌍</span>
                {active && <span className="globe-style-check" aria-hidden="true">✓</span>}
              </div>
              <span className="globe-style-emoji" aria-hidden="true">{style.emoji}</span>
              <span className="globe-style-label">{style.label}</span>
            </button>
          )
        })}
      </div>

      <div className="globe-customizer-sep" />

      <button
        className={`globe-option-row${showHeatmap ? ' globe-option-row--on' : ''}`}
        onClick={onHeatmapToggle}
        role="switch"
        aria-checked={showHeatmap}
      >
        <span className="globe-option-icon">🌡</span>
        <div className="globe-option-body">
          <span className="globe-option-label">Mood heatmap</span>
          <span className="globe-option-sub">Density overlay of all check-ins</span>
        </div>
        <span className={`globe-option-toggle${showHeatmap ? ' globe-option-toggle--on' : ''}`} aria-hidden="true" />
      </button>
    </div>
  )
}
