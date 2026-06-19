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
