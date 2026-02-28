import { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'
import { registerForPushNotifications } from './push'

const STUDIO_STORAGE_KEY = 'selected_studio_id'

interface AuthContextType {
  session: Session | null
  user: User | null
  loading: boolean
  studioId: string | null
  studioLoaded: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, name?: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshStudio: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  studioId: null,
  studioLoaded: false,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  refreshStudio: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [studioId, setStudioId] = useState<string | null>(null)
  const [studioLoaded, setStudioLoaded] = useState(false)

  async function fetchPrimaryStudio(userId: string) {
    try {
      // Check if user has a persisted studio selection
      const savedStudioId = await AsyncStorage.getItem(STUDIO_STORAGE_KEY)

      if (savedStudioId) {
        // Verify the saved studio is still a valid active membership
        const { data: valid } = await supabase
          .from('memberships')
          .select('studio_id')
          .eq('user_id', userId)
          .eq('studio_id', savedStudioId)
          .eq('status', 'active')
          .single()
        if (valid) {
          setStudioId(valid.studio_id)
          setStudioLoaded(true)
          return
        }
      }

      // Fall back to first active membership
      const { data } = await supabase
        .from('memberships')
        .select('studio_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: true })
        .limit(1)
        .single()
      if (data) setStudioId(data.studio_id)
    } catch {
      // No studio membership yet
    } finally {
      setStudioLoaded(true)
    }
  }

  const refreshStudio = async () => {
    if (session?.user) {
      setStudioLoaded(false)
      await fetchPrimaryStudio(session.user.id)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        fetchPrimaryStudio(session.user.id)
        registerForPushNotifications()
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        fetchPrimaryStudio(session.user.id)
        registerForPushNotifications()
      } else {
        setStudioId(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  const signUp = async (email: string, password: string, name?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: name ? { data: { name } } : undefined,
    })
    return { error: error as Error | null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    await AsyncStorage.removeItem(STUDIO_STORAGE_KEY)
    setStudioId(null)
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, studioId, studioLoaded, signIn, signUp, signOut, refreshStudio }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
