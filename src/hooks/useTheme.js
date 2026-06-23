import { useEffect, useState } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('hay_theme') || 'dark'
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('hay_theme', theme)
  }, [theme])

  return {
    theme,
    toggle:   () => setTheme(t => t === 'dark' ? 'light' : 'dark'),
    setTheme,
  }
}
