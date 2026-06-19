// Fuzzes a GPS coordinate by a random offset up to ~200 metres
// This prevents pinpointing a user's exact location on the map

const FUZZ_DEGREES = 0.002 // roughly 200m at most latitudes

export function fuzzLocation(lat, lng) {
  const latOffset = (Math.random() - 0.5) * FUZZ_DEGREES * 2
  const lngOffset = (Math.random() - 0.5) * FUZZ_DEGREES * 2
  return {
    lat: lat + latOffset,
    lng: lng + lngOffset,
  }
}

// Looks up the ISO-3166-1 alpha-2 country code for a coordinate using Mapbox Geocoding
// Returns e.g. "NG", "GB", "US", or null on failure (pin still saves without country)
export async function reverseGeocodeCountry(lat, lng) {
  try {
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    const url   = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=country&access_token=${token}`
    const res   = await fetch(url)
    const json  = await res.json()
    return json.features?.[0]?.properties?.short_code?.toUpperCase() ?? null
  } catch {
    return null
  }
}

// Gets the user's current position via browser geolocation
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: 10000, maximumAge: 60000 }
    )
  })
}
