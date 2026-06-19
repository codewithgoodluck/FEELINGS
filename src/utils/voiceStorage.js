import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase'

export async function uploadVoice(blob) {
  const name       = `voices/${Date.now()}_${Math.random().toString(36).slice(2)}.webm`
  const storageRef = ref(storage, name)
  const metadata   = { contentType: blob.type || 'audio/webm' }
  const snap       = await uploadBytes(storageRef, blob, metadata)
  return getDownloadURL(snap.ref)
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
