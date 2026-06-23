import { useState, useMemo, useRef } from 'react'

const COUNTRIES = [
  { code: 'AF', name: 'Afghanistan',            lat:  33.93, lng:  67.71 },
  { code: 'AL', name: 'Albania',                lat:  41.15, lng:  20.17 },
  { code: 'DZ', name: 'Algeria',                lat:  28.03, lng:   1.66 },
  { code: 'AO', name: 'Angola',                 lat: -11.20, lng:  17.87 },
  { code: 'AR', name: 'Argentina',              lat: -38.42, lng: -63.62 },
  { code: 'AM', name: 'Armenia',                lat:  40.07, lng:  45.04 },
  { code: 'AU', name: 'Australia',              lat: -25.27, lng: 133.78 },
  { code: 'AT', name: 'Austria',                lat:  47.52, lng:  14.55 },
  { code: 'AZ', name: 'Azerbaijan',             lat:  40.14, lng:  47.58 },
  { code: 'BS', name: 'Bahamas',                lat:  25.03, lng: -77.40 },
  { code: 'BH', name: 'Bahrain',                lat:  26.07, lng:  50.55 },
  { code: 'BD', name: 'Bangladesh',             lat:  23.68, lng:  90.36 },
  { code: 'BY', name: 'Belarus',                lat:  53.71, lng:  27.95 },
  { code: 'BE', name: 'Belgium',                lat:  50.50, lng:   4.47 },
  { code: 'BZ', name: 'Belize',                 lat:  17.19, lng: -88.50 },
  { code: 'BJ', name: 'Benin',                  lat:   9.31, lng:   2.32 },
  { code: 'BT', name: 'Bhutan',                 lat:  27.51, lng:  90.43 },
  { code: 'BO', name: 'Bolivia',                lat: -16.29, lng: -63.59 },
  { code: 'BA', name: 'Bosnia & Herzegovina',   lat:  43.92, lng:  17.68 },
  { code: 'BW', name: 'Botswana',               lat: -22.33, lng:  24.68 },
  { code: 'BR', name: 'Brazil',                 lat: -14.24, lng: -51.93 },
  { code: 'BN', name: 'Brunei',                 lat:   4.54, lng: 114.73 },
  { code: 'BG', name: 'Bulgaria',               lat:  42.73, lng:  25.49 },
  { code: 'BF', name: 'Burkina Faso',           lat:  12.36, lng:  -1.56 },
  { code: 'BI', name: 'Burundi',                lat:  -3.37, lng:  29.92 },
  { code: 'CV', name: 'Cabo Verde',             lat:  16.00, lng: -24.01 },
  { code: 'KH', name: 'Cambodia',               lat:  12.57, lng: 104.99 },
  { code: 'CM', name: 'Cameroon',               lat:   3.85, lng:  11.50 },
  { code: 'CA', name: 'Canada',                 lat:  56.13, lng: -106.35 },
  { code: 'CF', name: 'Central African Rep.',   lat:   6.61, lng:  20.94 },
  { code: 'TD', name: 'Chad',                   lat:  15.45, lng:  18.73 },
  { code: 'CL', name: 'Chile',                  lat: -35.68, lng: -71.54 },
  { code: 'CN', name: 'China',                  lat:  35.86, lng: 104.20 },
  { code: 'CO', name: 'Colombia',               lat:   4.57, lng: -74.30 },
  { code: 'KM', name: 'Comoros',                lat: -11.88, lng:  43.87 },
  { code: 'CD', name: 'Congo (DRC)',             lat:  -4.04, lng:  21.76 },
  { code: 'CG', name: 'Congo',                  lat:  -0.23, lng:  15.83 },
  { code: 'CR', name: 'Costa Rica',             lat:   9.75, lng: -83.75 },
  { code: 'HR', name: 'Croatia',                lat:  45.10, lng:  15.20 },
  { code: 'CU', name: 'Cuba',                   lat:  21.52, lng: -77.78 },
  { code: 'CY', name: 'Cyprus',                 lat:  35.13, lng:  33.43 },
  { code: 'CZ', name: 'Czech Republic',         lat:  49.82, lng:  15.47 },
  { code: 'DK', name: 'Denmark',                lat:  56.26, lng:   9.50 },
  { code: 'DJ', name: 'Djibouti',               lat:  11.83, lng:  42.59 },
  { code: 'DO', name: 'Dominican Republic',     lat:  18.74, lng: -70.16 },
  { code: 'EC', name: 'Ecuador',                lat:  -1.83, lng: -78.18 },
  { code: 'EG', name: 'Egypt',                  lat:  26.82, lng:  30.80 },
  { code: 'SV', name: 'El Salvador',            lat:  13.79, lng: -88.90 },
  { code: 'GQ', name: 'Equatorial Guinea',      lat:   1.65, lng:  10.27 },
  { code: 'ER', name: 'Eritrea',                lat:  15.18, lng:  39.78 },
  { code: 'EE', name: 'Estonia',                lat:  58.60, lng:  25.01 },
  { code: 'SZ', name: 'Eswatini',               lat: -26.52, lng:  31.47 },
  { code: 'ET', name: 'Ethiopia',               lat:   9.15, lng:  40.49 },
  { code: 'FJ', name: 'Fiji',                   lat: -17.71, lng: 178.07 },
  { code: 'FI', name: 'Finland',                lat:  61.92, lng:  25.75 },
  { code: 'FR', name: 'France',                 lat:  46.23, lng:   2.21 },
  { code: 'GA', name: 'Gabon',                  lat:  -0.80, lng:  11.61 },
  { code: 'GM', name: 'Gambia',                 lat:  13.44, lng: -15.31 },
  { code: 'GE', name: 'Georgia',                lat:  42.32, lng:  43.36 },
  { code: 'DE', name: 'Germany',                lat:  51.17, lng:  10.45 },
  { code: 'GH', name: 'Ghana',                  lat:   7.95, lng:  -1.02 },
  { code: 'GR', name: 'Greece',                 lat:  39.07, lng:  21.82 },
  { code: 'GT', name: 'Guatemala',              lat:  15.78, lng: -90.23 },
  { code: 'GN', name: 'Guinea',                 lat:  11.00, lng: -10.90 },
  { code: 'GW', name: 'Guinea-Bissau',          lat:  11.80, lng: -15.18 },
  { code: 'GY', name: 'Guyana',                 lat:   4.86, lng: -58.93 },
  { code: 'HT', name: 'Haiti',                  lat:  18.97, lng: -72.29 },
  { code: 'HN', name: 'Honduras',               lat:  15.20, lng: -86.24 },
  { code: 'HU', name: 'Hungary',                lat:  47.16, lng:  19.50 },
  { code: 'IS', name: 'Iceland',                lat:  64.96, lng: -19.02 },
  { code: 'IN', name: 'India',                  lat:  20.59, lng:  78.96 },
  { code: 'ID', name: 'Indonesia',              lat:  -0.79, lng: 113.92 },
  { code: 'IR', name: 'Iran',                   lat:  32.43, lng:  53.69 },
  { code: 'IQ', name: 'Iraq',                   lat:  33.22, lng:  43.68 },
  { code: 'IE', name: 'Ireland',                lat:  53.41, lng:  -8.24 },
  { code: 'IL', name: 'Israel',                 lat:  31.05, lng:  34.85 },
  { code: 'IT', name: 'Italy',                  lat:  41.87, lng:  12.57 },
  { code: 'JM', name: 'Jamaica',                lat:  18.11, lng: -77.30 },
  { code: 'JP', name: 'Japan',                  lat:  36.20, lng: 138.25 },
  { code: 'JO', name: 'Jordan',                 lat:  30.59, lng:  36.24 },
  { code: 'KZ', name: 'Kazakhstan',             lat:  48.02, lng:  66.92 },
  { code: 'KE', name: 'Kenya',                  lat:  -0.02, lng:  37.91 },
  { code: 'KP', name: 'North Korea',            lat:  40.34, lng: 127.51 },
  { code: 'KR', name: 'South Korea',            lat:  35.91, lng: 127.77 },
  { code: 'KW', name: 'Kuwait',                 lat:  29.31, lng:  47.48 },
  { code: 'KG', name: 'Kyrgyzstan',             lat:  41.20, lng:  74.76 },
  { code: 'LA', name: 'Laos',                   lat:  19.86, lng: 102.50 },
  { code: 'LV', name: 'Latvia',                 lat:  56.88, lng:  24.60 },
  { code: 'LB', name: 'Lebanon',                lat:  33.85, lng:  35.86 },
  { code: 'LS', name: 'Lesotho',                lat: -29.61, lng:  28.23 },
  { code: 'LR', name: 'Liberia',                lat:   6.43, lng:  -9.43 },
  { code: 'LY', name: 'Libya',                  lat:  26.34, lng:  17.23 },
  { code: 'LI', name: 'Liechtenstein',          lat:  47.14, lng:   9.55 },
  { code: 'LT', name: 'Lithuania',              lat:  55.17, lng:  23.88 },
  { code: 'LU', name: 'Luxembourg',             lat:  49.82, lng:   6.13 },
  { code: 'MG', name: 'Madagascar',             lat: -18.77, lng:  46.87 },
  { code: 'MW', name: 'Malawi',                 lat: -13.25, lng:  34.30 },
  { code: 'MY', name: 'Malaysia',               lat:   4.21, lng: 108.00 },
  { code: 'MV', name: 'Maldives',               lat:   3.20, lng:  73.22 },
  { code: 'ML', name: 'Mali',                   lat:  17.57, lng:  -3.99 },
  { code: 'MT', name: 'Malta',                  lat:  35.94, lng:  14.38 },
  { code: 'MR', name: 'Mauritania',             lat:  21.01, lng: -10.94 },
  { code: 'MU', name: 'Mauritius',              lat: -20.35, lng:  57.55 },
  { code: 'MX', name: 'Mexico',                 lat:  23.63, lng: -102.55 },
  { code: 'MD', name: 'Moldova',                lat:  47.41, lng:  28.37 },
  { code: 'MN', name: 'Mongolia',               lat:  46.86, lng: 103.85 },
  { code: 'ME', name: 'Montenegro',             lat:  42.71, lng:  19.37 },
  { code: 'MA', name: 'Morocco',                lat:  31.79, lng:  -7.09 },
  { code: 'MZ', name: 'Mozambique',             lat: -18.67, lng:  35.53 },
  { code: 'MM', name: 'Myanmar',                lat:  21.91, lng:  95.96 },
  { code: 'NA', name: 'Namibia',                lat: -22.96, lng:  18.49 },
  { code: 'NP', name: 'Nepal',                  lat:  28.39, lng:  84.12 },
  { code: 'NL', name: 'Netherlands',            lat:  52.13, lng:   5.29 },
  { code: 'NZ', name: 'New Zealand',            lat: -40.90, lng: 174.89 },
  { code: 'NI', name: 'Nicaragua',              lat:  12.87, lng: -85.21 },
  { code: 'NE', name: 'Niger',                  lat:  17.61, lng:   8.08 },
  { code: 'NG', name: 'Nigeria',                lat:   9.08, lng:   8.68 },
  { code: 'MK', name: 'North Macedonia',        lat:  41.61, lng:  21.75 },
  { code: 'NO', name: 'Norway',                 lat:  60.47, lng:   8.47 },
  { code: 'OM', name: 'Oman',                   lat:  21.51, lng:  55.92 },
  { code: 'PK', name: 'Pakistan',               lat:  30.38, lng:  69.35 },
  { code: 'PA', name: 'Panama',                 lat:   8.54, lng: -80.78 },
  { code: 'PG', name: 'Papua New Guinea',       lat:  -6.31, lng: 143.96 },
  { code: 'PY', name: 'Paraguay',               lat: -23.44, lng: -58.44 },
  { code: 'PE', name: 'Peru',                   lat:  -9.19, lng: -75.02 },
  { code: 'PH', name: 'Philippines',            lat:  12.88, lng: 121.77 },
  { code: 'PL', name: 'Poland',                 lat:  51.92, lng:  19.15 },
  { code: 'PT', name: 'Portugal',               lat:  39.40, lng:  -8.22 },
  { code: 'QA', name: 'Qatar',                  lat:  25.35, lng:  51.18 },
  { code: 'RO', name: 'Romania',                lat:  45.94, lng:  24.97 },
  { code: 'RU', name: 'Russia',                 lat:  61.52, lng: 105.32 },
  { code: 'RW', name: 'Rwanda',                 lat:  -1.94, lng:  29.87 },
  { code: 'SA', name: 'Saudi Arabia',           lat:  23.89, lng:  45.08 },
  { code: 'SN', name: 'Senegal',                lat:  14.50, lng: -14.45 },
  { code: 'RS', name: 'Serbia',                 lat:  44.02, lng:  21.01 },
  { code: 'SL', name: 'Sierra Leone',           lat:   8.46, lng: -11.78 },
  { code: 'SG', name: 'Singapore',              lat:   1.35, lng: 103.82 },
  { code: 'SK', name: 'Slovakia',               lat:  48.67, lng:  19.70 },
  { code: 'SI', name: 'Slovenia',               lat:  46.15, lng:  14.99 },
  { code: 'SO', name: 'Somalia',                lat:   5.15, lng:  46.20 },
  { code: 'ZA', name: 'South Africa',           lat: -30.56, lng:  22.94 },
  { code: 'SS', name: 'South Sudan',            lat:   6.88, lng:  31.31 },
  { code: 'ES', name: 'Spain',                  lat:  40.46, lng:  -3.75 },
  { code: 'LK', name: 'Sri Lanka',              lat:   7.87, lng:  80.77 },
  { code: 'SD', name: 'Sudan',                  lat:  12.86, lng:  30.22 },
  { code: 'SR', name: 'Suriname',               lat:   3.92, lng: -56.03 },
  { code: 'SE', name: 'Sweden',                 lat:  60.13, lng:  18.64 },
  { code: 'CH', name: 'Switzerland',            lat:  46.82, lng:   8.23 },
  { code: 'SY', name: 'Syria',                  lat:  34.80, lng:  38.99 },
  { code: 'TW', name: 'Taiwan',                 lat:  23.70, lng: 120.96 },
  { code: 'TJ', name: 'Tajikistan',             lat:  38.86, lng:  71.28 },
  { code: 'TZ', name: 'Tanzania',               lat:  -6.37, lng:  34.89 },
  { code: 'TH', name: 'Thailand',               lat:  15.87, lng: 100.99 },
  { code: 'TL', name: 'Timor-Leste',            lat:  -8.87, lng: 125.73 },
  { code: 'TG', name: 'Togo',                   lat:   8.62, lng:   0.82 },
  { code: 'TT', name: 'Trinidad & Tobago',      lat:  10.69, lng: -61.22 },
  { code: 'TN', name: 'Tunisia',                lat:  33.89, lng:   9.54 },
  { code: 'TR', name: 'Turkey',                 lat:  38.96, lng:  35.24 },
  { code: 'TM', name: 'Turkmenistan',           lat:  38.97, lng:  59.56 },
  { code: 'UG', name: 'Uganda',                 lat:   1.37, lng:  32.29 },
  { code: 'UA', name: 'Ukraine',                lat:  48.38, lng:  31.17 },
  { code: 'AE', name: 'United Arab Emirates',   lat:  23.42, lng:  53.85 },
  { code: 'GB', name: 'United Kingdom',         lat:  55.38, lng:  -3.44 },
  { code: 'US', name: 'United States',          lat:  37.09, lng: -95.71 },
  { code: 'UY', name: 'Uruguay',                lat: -32.52, lng: -55.77 },
  { code: 'UZ', name: 'Uzbekistan',             lat:  41.38, lng:  64.59 },
  { code: 'VE', name: 'Venezuela',              lat:   6.42, lng: -66.59 },
  { code: 'VN', name: 'Vietnam',                lat:  14.06, lng: 108.28 },
  { code: 'YE', name: 'Yemen',                  lat:  15.55, lng:  48.52 },
  { code: 'ZM', name: 'Zambia',                 lat: -13.13, lng:  27.85 },
  { code: 'ZW', name: 'Zimbabwe',               lat: -19.02, lng:  29.15 },
]

function flag(code) {
  if (!code || code.length !== 2) return '🌐'
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  )
}

export default function LocationGate({ onConfirm }) {
  const [query, setQuery]   = useState('')
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError]     = useState('')
  const [searching, setSearching]   = useState(false)
  const inputRef = useRef(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COUNTRIES
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q
    )
  }, [query])

  async function handleGPS() {
    setGpsError('')
    setGpsLoading(true)
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 12000 })
      )
      onConfirm({ lat: pos.coords.latitude, lng: pos.coords.longitude, fromGPS: true })
    } catch {
      setGpsError('Location access denied. Search your country below.')
      setSearching(true)
      setTimeout(() => inputRef.current?.focus(), 80)
    } finally {
      setGpsLoading(false)
    }
  }

  function pick(country) {
    onConfirm({ lat: country.lat, lng: country.lng, country: country.code, countryName: country.name, fromGPS: false })
  }

  return (
    <div className="loc-gate">
      <div className="loc-gate-bg" aria-hidden="true" />

      <div className="loc-gate-page">
        {/* ── Header ── */}
        <div className="loc-gate-header">
          <div className="loc-gate-icon">🌍</div>
          <h1 className="loc-gate-title">Where are you right now?</h1>
          <p className="loc-gate-body">
            HowAreYou connects you with people feeling things nearby.
            Your location is <strong>never stored exactly</strong> — blurred by a few km for privacy.
          </p>
        </div>

        {/* ── GPS button ── */}
        <button
          className="btn btn--primary btn--full loc-gate-gps-btn"
          onClick={handleGPS}
          disabled={gpsLoading}
        >
          {gpsLoading ? '📡 Getting location…' : '📡 Use my current location'}
        </button>

        {gpsError && <p className="loc-gate-error">{gpsError}</p>}

        {/* ── Divider ── */}
        <div className="loc-gate-divider">
          <span>or search your country</span>
        </div>

        {/* ── Search ── */}
        <div className="loc-gate-search-wrap">
          <input
            ref={inputRef}
            className="loc-gate-search"
            type="text"
            inputMode="search"
            placeholder="Type a country name…"
            value={query}
            onChange={e => { setQuery(e.target.value); setSearching(true) }}
            onFocus={() => setSearching(true)}
            autoComplete="off"
            spellCheck={false}
            aria-label="Search country"
          />
          {query && (
            <button
              className="loc-gate-clear"
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              aria-label="Clear search"
            >✕</button>
          )}
        </div>

        {/* ── Country list — always visible, tap = done ── */}
        <div className="loc-gate-list">
          {filtered.length === 0 ? (
            <p className="loc-gate-empty">No country found — try a different spelling.</p>
          ) : (
            filtered.map(c => (
              <button
                key={c.code}
                className="loc-gate-country"
                onClick={() => pick(c)}
              >
                <span className="loc-gate-country-flag">{flag(c.code)}</span>
                <span className="loc-gate-country-name">{c.name}</span>
                <span className="loc-gate-country-arrow">→</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
