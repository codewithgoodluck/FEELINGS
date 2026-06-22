const DEG = Math.PI / 180
const RAD = 180 / Math.PI

function dayOfYear(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  return Math.floor((date.getTime() - start) / 86_400_000)
}

// Returns { lat, lon } of the subsolar point (sun directly overhead) in degrees.
// Declination: 23.44° × sin(360/365 × (doy − 81)°)
// Subsolar longitude: sun is at 0° lon at UTC noon; moves west 15°/hr.
export function getSubsolarPoint(date) {
  const doy   = dayOfYear(date)
  const decl  = 23.44 * Math.sin(DEG * (360 / 365) * (doy - 81))
  const utcH  = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const lon   = (12 - utcH) * 15          // 0° lon at noon UTC; west = negative
  return { lat: decl, lon }
}

// Returns an array of [lon, lat] pairs tracing the night-hemisphere boundary
// (the great circle 90° from the subsolar point), closing the polygon ring.
// The polygon covers the dark hemisphere so it can be used as a GeoJSON fill.
export function getTerminatorPolygon(date) {
  const { lat: sLat, lon: sLon } = getSubsolarPoint(date)
  const sLatR = sLat * DEG
  const sLonR = sLon * DEG

  // Precompute subsolar point in Cartesian
  const sX = Math.cos(sLatR) * Math.cos(sLonR)
  const sY = Math.cos(sLatR) * Math.sin(sLonR)
  const sZ = Math.sin(sLatR)

  // Sample the terminator great-circle at ~4° steps
  const ring = []
  const STEP = 4
  for (let az = 0; az <= 360; az += STEP) {
    const azR = az * DEG
    // Build an orthogonal basis to the subsolar vector and walk the great circle
    // perpendicular to it (90° away = terminator).
    // Basis vector 1: north pole cross subsolar (or use a fallback)
    let bx, by, bz
    if (Math.abs(sZ) < 0.999) {
      // cross product of subsolar with north pole (0,0,1)
      bx = -sY; by = sX; bz = 0
    } else {
      // subsolar is near a pole — use x-axis instead
      bx = 0; by = 1; bz = 0
    }
    const bLen = Math.sqrt(bx * bx + by * by + bz * bz)
    bx /= bLen; by /= bLen; bz /= bLen

    // Basis vector 2: subsolar cross b
    const cx = sY * bz - sZ * by
    const cy = sZ * bx - sX * bz
    const cz = sX * by - sY * bx

    // Point on terminator: cos(az)*b + sin(az)*c  (already 90° from subsolar)
    const px = Math.cos(azR) * bx + Math.sin(azR) * cx
    const py = Math.cos(azR) * by + Math.sin(azR) * cy
    const pz = Math.cos(azR) * bz + Math.sin(azR) * cz

    const pLat = Math.asin(Math.max(-1, Math.min(1, pz))) * RAD
    const pLon = Math.atan2(py, px) * RAD
    ring.push([pLon, pLat])
  }

  // Close the ring
  ring.push(ring[0])

  // Build a polygon that covers the night hemisphere.
  // Strategy: extend from the terminator ring down through the anti-subsolar pole
  // by appending the night-pole point so the polygon fill covers the dark side.
  // We check which pole is in night: if sLat > 0 the south pole is in night, else north.
  const nightPole = sLat >= 0 ? [0, -89.9] : [0, 89.9]

  // Wrap the terminator into a closed polygon covering night side:
  // ring (terminator boundary) + night pole at both longitude extremes to close fill
  const poly = [
    ...ring,
    [ring[ring.length - 2][0], nightPole[1]],
    nightPole,
    [ring[0][0], nightPole[1]],
    ring[0],
  ]

  return poly
}

export function getTerminatorGeoJSON(date) {
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [getTerminatorPolygon(date)],
    },
    properties: {},
  }
}

// Returns true when [lon, lat] is on the night side.
// Night side = angular distance from subsolar point > 90°.
export function isPinInNight(lat, lon, subsolar) {
  const latR  = lat * DEG
  const lonR  = lon * DEG
  const sLatR = subsolar.lat * DEG
  const sLonR = subsolar.lon * DEG
  // dot product of unit vectors
  const dot = Math.sin(latR) * Math.sin(sLatR)
            + Math.cos(latR) * Math.cos(sLatR) * Math.cos(lonR - sLonR)
  return dot < 0   // dot < 0 → angle > 90° → night side
}
