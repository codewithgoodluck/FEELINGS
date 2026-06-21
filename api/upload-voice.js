import { put } from '@vercel/blob'

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const contentType = req.headers['content-type'] || 'audio/webm'
    const ext = contentType.includes('mp4') ? 'mp4' : 'webm'
    const pathname = `voices/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const blob = await put(pathname, req, {
      access: 'public',
      contentType,
    })

    res.status(200).json({ url: blob.url })
  } catch (err) {
    console.error('upload-voice error:', err)
    res.status(500).json({ error: err.message || 'Upload failed' })
  }
}
