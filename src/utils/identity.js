// Generates a consistent anonymous identity from a Firebase user ID
// e.g. "Amber Owl", "Silver Fox", "Quiet Heron"

const ADJECTIVES = [
  'Amber', 'Azure', 'Bold', 'Bright', 'Calm', 'Cobalt', 'Coral',
  'Crimson', 'Dawn', 'Deep', 'Dusk', 'Echo', 'Ember', 'Fern',
  'Frost', 'Golden', 'Indigo', 'Jade', 'Lunar', 'Misty', 'Moss',
  'Ochre', 'Opal', 'Pine', 'Quiet', 'Rose', 'Ruby', 'Sage',
  'Sand', 'Silver', 'Sky', 'Slate', 'Solar', 'Storm', 'Swift',
  'Teal', 'Terra', 'Tidal', 'Violet', 'Wild',
]

const ANIMALS = [
  'Bear', 'Crane', 'Crow', 'Deer', 'Dolphin', 'Eagle', 'Falcon',
  'Fox', 'Hare', 'Hawk', 'Heron', 'Ibis', 'Kite', 'Lark',
  'Leopard', 'Lynx', 'Mink', 'Moth', 'Otter', 'Owl', 'Panda',
  'Raven', 'Robin', 'Seal', 'Sparrow', 'Stag', 'Swan', 'Tiger',
  'Vole', 'Wolf', 'Wren',
]

// Deterministic hash so the same uid always gets the same name
function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

// Pass country (ISO-3166 code) so participants near the same location
// get geographically-varied names; omit for a UID-only hash.
export function getAnonIdentity(uid, country) {
  const seed = uid && country ? `${uid}:${country}` : (uid || 'anon')
  const hash = hashString(seed)
  const adj = ADJECTIVES[hash % ADJECTIVES.length]
  const animal = ANIMALS[Math.floor(hash / ADJECTIVES.length) % ANIMALS.length]
  return `${adj} ${animal}`
}

// Assign a colour to each anonymous user (used for pin and chat bubble)
const PALETTE = [
  '#E07A5F', '#3D405B', '#81B29A', '#F2CC8F', '#118AB2',
  '#06D6A0', '#FFB703', '#8338EC', '#FB5607', '#3A86FF',
]

export function getAnonColour(uid) {
  const hash = hashString(uid)
  return PALETTE[hash % PALETTE.length]
}

// Assigns a distinct HSL colour to each country code (e.g. "NG", "GB").
// Golden-angle step (137.508°) gives maximum hue separation across the spectrum.
export function getCountryColour(country) {
  if (!country) return '#888'
  const hash = hashString(country.toUpperCase())
  const hue  = Math.round((hash * 137.508) % 360)
  const sat  = 62 + (hash % 18)   // 62–80 %
  const lit  = 50 + (hash % 14)   // 50–64 %
  return `hsl(${hue},${sat}%,${lit}%)`
}
