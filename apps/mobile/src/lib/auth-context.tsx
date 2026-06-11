import { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'
import { registerForPushNotifications } from './push'
import {
  DEMO_MODE_STORAGE_KEY,
  DEMO_STUDIO_ID,
  DemoRole,
  getDemoIdentity,
  getDemoModeRole,
  isDemoRole,
  setDemoModeRole,
} from './demo-mode'
import { resetDemoState } from './demo-api'

const STUDIO_STORAGE_KEY = 'selected_studio_id'

interface AuthContextType {
  session: Session | null
  user: User | null
  loading: boolean
  studioId: string | null
  studioLoaded: boolean
  isDemoMode: boolean
  demoRole: DemoRole | null
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, name?: string) => Promise<{ error: Error | null }>
  startDemo: (role: DemoRole) => Promise<void>
  signOut: () => Promise<void>
  refreshStudio: () => Promise<void>
}

function createDemoSession(role: DemoRole): Session {
  const identity = getDemoIdentity(role)
  const nowIso = new Date().toISOString()
  const user = {
    id: identity.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: identity.email,
    phone: '',
    created_at: nowIso,
    updated_at: nowIso,
    app_metadata: { provider: 'demo', providers: ['demo'] },
    user_metadata: { name: identity.name, demo_role: role },
    identities: [],
  } as unknown as User

  return {
    access_token: `demo-access-token-${role}`,
    refresh_token: `demo-refresh-token-${role}`,
    token_type: 'bearer',
    expires_in: 60 * 60,
    expires_at: Math.floor(Date.now() / 1000) + (60 * 60),
    user,
  } as Session
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  studioId: null,
  studioLoaded: false,
  isDemoMode: false,
  demoRole: null,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  startDemo: async () => {},
  signOut: async () => {},
  refreshStudio: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [studioId, setStudioId] = useState<string | null>(null)
  const [studioLoaded, setStudioLoaded] = useState(false)
  const [demoRole, setDemoRole] = useState<DemoRole | null>(null)

  const isDemoMode = demoRole !== null

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

  async function activateDemo(role: DemoRole, persist = true) {
    setDemoModeRole(role)
    setDemoRole(role)
    resetDemoState(role)

    if (persist) {
      await AsyncStorage.setItem(DEMO_MODE_STORAGE_KEY, role)
    }
    await AsyncStorage.setItem(STUDIO_STORAGE_KEY, DEMO_STUDIO_ID)

    setSession(createDemoSession(role))
    setStudioId(DEMO_STUDIO_ID)
    setStudioLoaded(true)
    setLoading(false)
  }

  const refreshStudio = async () => {
    if (demoRole) {
      setStudioId(DEMO_STUDIO_ID)
      setStudioLoaded(true)
      return
    }

    if (session?.user) {
      setStudioLoaded(false)
      await fetchPrimaryStudio(session.user.id)
    } else {
      setStudioId(null)
      setStudioLoaded(true)
    }
  }

  useEffect(() => {
    let isMounted = true
    let unsubscribe: (() => void) | null = null

    function applySession(nextSession: Session | null) {
      setSession(nextSession)
      if (nextSession?.user) {
        setStudioLoaded(false)
        fetchPrimaryStudio(nextSession.user.id)
        registerForPushNotifications()
      } else {
        setStudioId(null)
        setStudioLoaded(true)
      }
    }

    async function bootstrap() {
      try {
        const savedDemoRole = await AsyncStorage.getItem(DEMO_MODE_STORAGE_KEY)
        if (!isMounted) return

        if (isDemoRole(savedDemoRole)) {
          await activateDemo(savedDemoRole, false)
        } else {
          setDemoModeRole(null)
          setDemoRole(null)
          const { data: { session: initialSession } } = await supabase.auth.getSession()
          if (!isMounted) return
          applySession(initialSession)
          setLoading(false)
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
          if (getDemoModeRole()) return
          setDemoRole(null)
          applySession(nextSession)
        })
        unsubscribe = () => subscription.unsubscribe()
      } catch {
        if (!isMounted) return
        setSession(null)
        setDemoModeRole(null)
        setDemoRole(null)
        setStudioId(null)
        setStudioLoaded(true)
        setLoading(false)
      }
    }

    bootstrap()

    return () => {
      isMounted = false
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    if (demoRole) {
      setDemoModeRole(null)
      setDemoRole(null)
      await AsyncStorage.removeItem(DEMO_MODE_STORAGE_KEY)
      setSession(null)
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  const signUp = async (email: string, password: string, name?: string) => {
    if (demoRole) {
      setDemoModeRole(null)
      setDemoRole(null)
      await AsyncStorage.removeItem(DEMO_MODE_STORAGE_KEY)
      setSession(null)
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: name ? { data: { name } } : undefined,
    })
    return { error: error as Error | null }
  }

  const startDemo = async (role: DemoRole) => {
    await supabase.auth.signOut().catch(() => {})
    await activateDemo(role, true)
  }

  const signOut = async () => {
    if (demoRole) {
      resetDemoState(demoRole)
      setDemoModeRole(null)
      setDemoRole(null)
      await AsyncStorage.multiRemove([DEMO_MODE_STORAGE_KEY, STUDIO_STORAGE_KEY])
      setSession(null)
      setStudioId(null)
      setStudioLoaded(true)
      return
    }

    await supabase.auth.signOut()
    await AsyncStorage.multiRemove([DEMO_MODE_STORAGE_KEY, STUDIO_STORAGE_KEY])
    setStudioId(null)
    setStudioLoaded(true)
  }

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      loading,
      studioId,
      studioLoaded,
      isDemoMode,
      demoRole,
      signIn,
      signUp,
      startDemo,
      signOut,
      refreshStudio,
    }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
