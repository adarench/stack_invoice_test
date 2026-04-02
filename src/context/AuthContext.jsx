import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, skipAuth } from '../lib/supabaseClient'
import { DEMO_USERS, ROLE_PERMISSIONS } from '../data/demoUsers'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const isMockMode = !supabase
  const isDemoMode = !!supabase && skipAuth  // DB connected but no login

  const [user, setUser] = useState((isMockMode || isDemoMode) ? DEMO_USERS[0] : null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(!isMockMode && !isDemoMode)

  useEffect(() => {
    if (isMockMode || isDemoMode) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [isMockMode, isDemoMode])

  /** Switch between demo users (demo mode only) */
  function switchUser(userId) {
    if (!isDemoMode && !isMockMode) return
    const next = DEMO_USERS.find(u => u.id === userId)
    if (next) setUser(next)
  }

  async function signIn(email) {
    if (isMockMode || isDemoMode) {
      setUser(DEMO_USERS[0])
      return { error: null }
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    return { error }
  }

  async function signOut() {
    if (isMockMode || isDemoMode) {
      setUser(null)
      return
    }
    await supabase.auth.signOut()
  }

  function displayName() {
    if (!user) return ''
    return user.full_name
      || user.user_metadata?.full_name
      || user.email?.split('@')[0]
      || 'User'
  }

  function initials() {
    const name = displayName()
    const parts = name.split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  const role = user?.role || 'uploader'
  const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.uploader

  return (
    <AuthContext.Provider value={{
      user, session, loading,
      isMockMode, isDemoMode,
      role, permissions,
      demoUsers: DEMO_USERS,
      switchUser,
      signIn, signOut, displayName, initials,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
