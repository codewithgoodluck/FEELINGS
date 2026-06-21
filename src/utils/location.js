const FUZZ_DEGREES = 0.0005 // ~50 m — enough for privacy, close enough to be useful

export function fuzzLocation(lat, lng) {
  const latOffset = (Math.random() - 0.5) * FUZZ_DEGREES * 2
  const lngOffset = (Math.random() - 0.5) * FUZZ_DEGREES * 2
  return { lat: lat + latOffset, lng: lng + lngOffset }
}

export async function reverseGeocodeCountry(lat, lng) {
  try {
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    const url   = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=country&access_token=${token}`
    const res   = await fetch(url)
    const json  = await res.json()
    return json.features?.[0]?.properties?.short_code?.toUpperCase() ?? null
  } catch { return null }
}

// Returns a human-readable neighbourhood / town / city name for the coordinates
export async function reverseGeocodePlaceName(lat, lng) {
  try {
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    const url   = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=neighborhood,locality,place&language=en&access_token=${token}`
    const res   = await fetch(url)
    const json  = await res.json()
    return json.features?.[0]?.text ?? null
  } catch { return null }
}

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
