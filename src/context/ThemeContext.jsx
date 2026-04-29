import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react'

const ThemeContext = createContext()
const STORAGE_KEY = 'opsflow-theme'

function getInitialIsDark() {
  if (typeof window === 'undefined') return false
  const savedTheme = window.localStorage.getItem(STORAGE_KEY)
  if (savedTheme === 'dark') return true
  if (savedTheme === 'light') return false
  return false
}

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(getInitialIsDark)

  useLayoutEffect(() => {
    if (isDark) {
      document.documentElement.classList.remove('light-mode')
    } else {
      document.documentElement.classList.add('light-mode')
    }
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
  }, [isDark])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light')
  }, [isDark])

  const toggle = () => setIsDark(d => !d)
  const setTheme = (nextTheme) => {
    if (nextTheme === 'dark') setIsDark(true)
    if (nextTheme === 'light') setIsDark(false)
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
