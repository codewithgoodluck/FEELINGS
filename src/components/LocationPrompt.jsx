// LocationPrompt — asks for location permission before showing the map
// If denied, falls back gracefully with a world view

export default function LocationPrompt({ onAllow, onSkip }) {
  return (
    <div className="location-prompt">
      <div className="location-prompt-card">
        <div className="location-prompt-icon" aria-hidden="true">📍</div>
        <h1 className="location-prompt-title">HowAreYou</h1>
        <p className="location-prompt-body">
          See how people around the world are really doing.
          We'll centre the map on your location — but your pin
          is always placed with a slight offset to keep you anonymous.
        </p>
        <button className="btn btn--primary btn--full" onClick={onAllow}>
          Share my location
        </button>
        <button className="btn btn--ghost btn--full" onClick={onSkip}>
          Show me the world map instead
        </button>
        <p className="location-prompt-notice">
          Your exact coordinates are never stored or shared.
        </p>
      </div>
    </div>
  )
}
