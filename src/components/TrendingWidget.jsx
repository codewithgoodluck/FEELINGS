import { useEffect, useState } from 'react'
import { subscribeToPins } from '../utils/db'

const MOOD_LABELS = {
  '😊': 'Good', '😔': 'Low', '😤': 'Frustrated', '😴': 'Tired',
  '🤔': 'Unsure', '🥳': 'Excited', '😰': 'Anxious', '😌': 'Calm',
  '😢': 'Sad', '😡': 'Angry', '🤗': 'Grateful', '🥺': 'Tender',
  '😶': 'Numb', '🤩': 'Amazed', '🫶': 'Loved', '🥱': 'Bored',
}

export default function TrendingWidget() {
  const [top3, setTop3] = useState([])

  useEffect(() => {
    return subscribeToPins((pins) => {
      const counts = {}
      pins.forEach(p => { if (p.mood) counts[p.mood] = (counts[p.mood] || 0) + 1 })
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3)
      setTop3(sorted)
    })
  }, [])

  if (top3.length === 0) return null

  const [topEmoji, topCount] = top3[0]

  return (
    <div className="trending-widget" role="status" aria-label="Trending moods">
      <span className="trending-label">Trending now</span>
      <div className="trending-moods">
        {top3.map(([emoji, count], i) => (
          <div key={emoji} className={`trending-mood${i === 0 ? ' trending-mood--top' : ''}`}>
            <span className="trending-emoji">{emoji}</span>
            <span className="trending-count">{count}</span>
          </div>
        ))}
      </div>
      <span className="trending-caption">
        {MOOD_LABELS[topEmoji] ?? 'Feeling'} · {topCount} {topCount === 1 ? 'person' : 'people'}
      </span>
    </div>
  )
}
