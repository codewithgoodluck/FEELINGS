// Free translation via MyMemory API — no API key needed.
// Auto-detects source language; target = user's browser language.
// In-memory cache avoids re-fetching the same text in a session.

const cache = new Map()

export function getUserLang() {
  return (navigator.language || 'en').split('-')[0].toLowerCase() || 'en'
}

export async function translateText(text, targetLang) {
  const to  = targetLang || getUserLang()
  const src = text?.trim()
  if (!src) return text

  const key = `${to}\x00${src}`
  if (cache.has(key)) return cache.get(key)

  const url =
    'https://api.mymemory.translated.net/get' +
    `?q=${encodeURIComponent(src.slice(0, 500))}` +
    `&langpair=autodetect|${to}`

  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()

  if (data.responseStatus !== 200) {
    throw new Error(data.responseMessage || 'Translation failed')
  }

  const translated = data.responseData.translatedText
  cache.set(key, translated)
  return translated
}
