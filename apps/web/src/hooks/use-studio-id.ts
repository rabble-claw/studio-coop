'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STORAGE_KEY = 'studio-coop-preferred-studio'

interface StudioInfo {
  id: string
  name: string
  role: string
}

interface UseStudioIdReturn {
  studioId: string | null
  studios: StudioInfo[]
  switchStudio: (studioId: string) => void
  loading: boolean
}

export function useStudioId(skip = false): UseStudioIdReturn {
  const router = useRouter()
  const [studioId, setStudioId] = useState<string | null>(null)
  const [studios, setStudios] = useState<StudioInfo[]>([])
  const [loading, setLoading] = useState(!skip)

  useEffect(() => {
    if (skip) return
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: memberships } = await supabase
        .from('memberships')
        .select('studio_id, role, studio:studios(id, name)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('joined_at')

      if (!memberships || memberships.length === 0) {
        setLoading(false)
        return
      }

      const studioList: StudioInfo[] = memberships.map((m) => {
        const s = m.studio as unknown as { id: string; name: string } | null
        return {
          id: m.studio_id,
          name: s?.name ?? 'Unknown Studio',
          role: m.role,
        }
      })
      setStudios(studioList)

      // Check localStorage for preferred studio
      let preferred: string | null = null
      try {
        preferred = localStorage.getItem(STORAGE_KEY)
      } catch {
        // localStorage unavailable
      }

      const validPreferred = preferred && studioList.some((s) => s.id === preferred)
      const selectedId = validPreferred ? preferred! : studioList[0]!.id
      setStudioId(selectedId)
      setLoading(false)
    }
    load()
  }, [router, skip])

  const switchStudio = useCallback((newStudioId: string) => {
    setStudioId(newStudioId)
    try {
      localStorage.setItem(STORAGE_KEY, newStudioId)
    } catch {
      // localStorage unavailable
    }
  }, [])

  return { studioId, studios, switchStudio, loading }
}
