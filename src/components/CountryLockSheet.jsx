import { countryFlag } from '../utils/presence'

export default function CountryLockSheet({
  tappedName, tappedCode,
  userCountry, userCountryName,
  onDismiss, onShareHere,
}) {
  return (
    <>
      <div className="country-lock-backdrop" onClick={onDismiss} aria-hidden="true" />
      <div className="country-lock-sheet" role="dialog" aria-label="Country lock">
        <div className="panel-handle" />
        <div className="country-lock-icon" aria-hidden="true">🗺️</div>
        <h2 className="country-lock-title">You're outside your country</h2>
        <p className="country-lock-body">
          HowAreYou is about sharing how you genuinely feel{' '}
          <em>where you are</em>. Your pin has been deactivated because it was
          placed in{' '}
          <strong>
            {tappedName ?? tappedCode}
            {tappedCode ? ` ${countryFlag(tappedCode)}` : ''}
          </strong>{' '}
          — not where you're located right now.
        </p>
        <div className="country-lock-pill">
          📍 Your location:{' '}
          <strong>
            {userCountry ? countryFlag(userCountry) : ''} {userCountryName ?? userCountry}
          </strong>
        </div>
        <div className="country-lock-btns">
          <button className="btn btn--ghost" onClick={onDismiss}>
            Maybe later
          </button>
          <button className="btn btn--primary" onClick={onShareHere}>
            Share here instead
          </button>
        </div>
      </div>
    </>
  )
}
