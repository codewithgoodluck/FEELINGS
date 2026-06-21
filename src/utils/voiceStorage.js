export async function uploadVoice(blob) {
  if (!blob || blob.size === 0) throw new Error('Recording is empty — please try again.')

  const controller = new AbortController()
  const timeoutId  = setTimeout(() => controller.abort(), 20_000)

  try {
    const res = await fetch('/api/upload-voice', {
      method:  'POST',
      headers: { 'Content-Type': blob.type || 'audio/webm' },
      body:    blob,
      signal:  controller.signal,
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `Upload failed (${res.status})`)
    }

    const { url } = await res.json()
    return url
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Upload timed out — check your connection and try again.')
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

export function getSupportedMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ]
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || ''
}
