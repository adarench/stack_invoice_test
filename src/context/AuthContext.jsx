import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, skipAuth, hasSupabaseCredentials, missingSupabaseConfigMessage } from '../lib/supabaseClient'
import { DEMO_USERS, ROLE_PERMISSIONS, normalizeRole } from '../data/demoUsers'
import { buildFallbackUser, ensureProfileForAuthUser } from '../api/profileApi'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const isMockMode = !supabase
  const isDemoMode = !!supabase && skipAuth  // DB connected but no login
  const isExplicitMockMode = isMockMode && skipAuth

  const [user, setUser] = useState((isDemoMode || isExplicitMockMode) ? DEMO_USERS[0] : null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(hasSupabaseCredentials && !isDemoMode)

  useEffect(() => {
    if (isMockMode || isDemoMode) return

    async function hydrateUser(nextSession) {
      setSession(nextSession)

      if (!nextSession?.user) {
        setUser(null)
        setLoading(false)
        return
      }

      const authUser = nextSession.user
      const fallbackUser = buildFallbackUser(authUser)

      try {
        const profile = await ensureProfileForAuthUser(authUser)

        if (!profile) {
          setUser(fallbackUser)
        } else {
          setUser({
            ...authUser,
            ...fallbackUser,
            ...profile,
            id: profile.id,
            profile_id: profile.id,
            auth_id: authUser.id,
            user_metadata: authUser.user_metadata || {},
          })
        }
      } catch (error) {
        console.warn('[AuthContext] Failed to load profile:', error.message)
        setUser(fallbackUser)
      }

      setLoading(false)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      hydrateUser(session).catch(err => {
        console.warn('[AuthContext] Session hydration failed:', err)
        setUser(null)
        setLoading(false)
      })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrateUser(session).catch(err => {
        console.warn('[AuthContext] Auth state hydration failed:', err)
        setUser(session?.user ?? null)
        setLoading(false)
      })
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

  async function signInWithPassword(email, password) {
    if (isMockMode || isDemoMode) {
      setUser(DEMO_USERS[0])
      return { error: null }
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
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

  const role = normalizeRole(user?.role)
  const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.ops

  return (
    <AuthContext.Provider value={{
      user, session, loading,
      isMockMode, isDemoMode, isExplicitMockMode,
      isConfigured: hasSupabaseCredentials,
      missingConfigMessage: missingSupabaseConfigMessage,
      role, permissions,
      demoUsers: DEMO_USERS,
      switchUser,
      signIn, signInWithPassword, signOut, displayName, initials,
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
