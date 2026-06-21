import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase'

export async function uploadVoice(blob) {
  if (!blob || blob.size === 0) throw new Error('Recording is empty — please try again.')

  const name       = `voices/${Date.now()}_${Math.random().toString(36).slice(2)}.webm`
  const storageRef = ref(storage, name)
  const metadata   = { contentType: blob.type || 'audio/webm' }

  let timeoutId
  try {
    const snap = await Promise.race([
      uploadBytes(storageRef, blob, metadata),
      new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Upload timed out — Firebase Storage may not be enabled. See console for details.')),
          20_000
        )
      }),
    ])
    return getDownloadURL(snap.ref)
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
