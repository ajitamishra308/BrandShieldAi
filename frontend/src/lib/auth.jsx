import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { DEMO_PASSWORD, getDemoUser } from './demo'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // While a demo link is signing in, an "empty" session must not send the visitor to the login page.
  const demoPending = useRef(Boolean(getDemoUser(window.location.search)))

  useEffect(() => {
    let active = true

    async function init() {
      const demo = getDemoUser(window.location.search)
      const { data } = await supabase.auth.getSession()
      let current = data.session
      if (demo && current?.user?.email !== demo.email) {
        const { data: signedIn } = await supabase.auth.signInWithPassword({ email: demo.email, password: DEMO_PASSWORD })
        current = signedIn?.session ?? current
      }
      if (demo) window.history.replaceState({}, '', window.location.pathname)
      demoPending.current = false
      if (!active) return
      setSession(current)
      if (!current) setLoading(false)
    }
    init()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession) {
        setSession(nextSession)
        return
      }
      if (demoPending.current) return
      setSession(null)
      setProfile(null)
      setLoading(false)
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
    email: session?.user?.email ?? null,
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
