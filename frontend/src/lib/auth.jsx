import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Watch the login session.
  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setProfile(null)
        setLoading(false)
      }
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  // Load the user's name and role once there is a session.
  const userId = session?.user?.id
  useEffect(() => {
    if (!userId) return
    let active = true
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (!active) return
        setProfile(error ? null : data)
        setLoading(false)
      })
    return () => { active = false }
  }, [userId])

  const value = {
    session,
    profile,
    loading,
    token: session?.access_token ?? null,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
