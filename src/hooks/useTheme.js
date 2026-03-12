// EasyDrive — Gerenciamento de tema: dark | light | system
import { useEffect, useState } from 'react'

const KEY = 'easydrive_theme'

function applyTheme(pref) {
  const resolved =
    pref === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : pref
  document.documentElement.dataset.theme = resolved
  return resolved
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => localStorage.getItem(KEY) || 'system')
  const [resolved, setResolved] = useState(() => applyTheme(localStorage.getItem(KEY) || 'system'))

  useEffect(() => {
    const res = applyTheme(theme)
    setResolved(res)

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e) => {
        const r = e.matches ? 'dark' : 'light'
        document.documentElement.dataset.theme = r
        setResolved(r)
      }
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  const setTheme = (t) => {
    localStorage.setItem(KEY, t)
    setThemeState(t)
  }

  return { theme, resolved, setTheme }
}
