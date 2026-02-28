import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, Modal, FlatList } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

const STUDIO_STORAGE_KEY = 'selected_studio_id'

interface Studio {
  id: string
  name: string
  discipline: string
  role: string
}

const disciplineEmoji: Record<string, string> = {
  pole: '\uD83D\uDC83',
  bjj: '\uD83E\uDD4B',
  yoga: '\uD83E\uDDD8',
  crossfit: '\uD83C\uDFCB\uFE0F',
  cycling: '\uD83D\uDEB4',
  pilates: '\uD83E\uDD38',
  dance: '\uD83D\uDC83',
  aerial: '\uD83C\uDFAA',
  general: '\uD83C\uDFE2',
}

export function useStudioSwitcher() {
  const { user, studioId, refreshStudio } = useAuth()
  const [studios, setStudios] = useState<Studio[]>([])
  const [currentStudio, setCurrentStudio] = useState<Studio | null>(null)
  const [showPicker, setShowPicker] = useState(false)

  useEffect(() => {
    if (!user) return
    loadStudios()
  }, [user])

  useEffect(() => {
    if (studioId && studios.length > 0) {
      const found = studios.find(s => s.id === studioId)
      if (found) setCurrentStudio(found)
    }
  }, [studioId, studios])

  async function loadStudios() {
    if (!user) return
    const { data } = await supabase
      .from('memberships')
      .select('role, studio:studios!memberships_studio_id_fkey(id, name, discipline)')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (data) {
      setStudios(data.map((m: any) => ({
        id: m.studio.id,
        name: m.studio.name,
        discipline: m.studio.discipline,
        role: m.role,
      })))
    }
  }

  async function selectStudio(studio: Studio) {
    await AsyncStorage.setItem(STUDIO_STORAGE_KEY, studio.id)
    setCurrentStudio(studio)
    setShowPicker(false)
    // Refresh the auth context studio
    await refreshStudio()
  }

  return { studios, currentStudio, showPicker, setShowPicker, selectStudio }
}

interface StudioSwitcherProps {
  studios: Studio[]
  currentStudio: Studio | null
  showPicker: boolean
  setShowPicker: (show: boolean) => void
  selectStudio: (studio: Studio) => void
}

export function StudioSwitcherHeader({ studios, currentStudio, showPicker, setShowPicker, selectStudio }: StudioSwitcherProps) {
  if (studios.length <= 1) {
    // Only one studio, just show the name
    return currentStudio ? (
      <View className="flex-row items-center">
        <Text className="text-lg mr-1.5">
          {disciplineEmoji[currentStudio.discipline] ?? '\uD83C\uDFE2'}
        </Text>
        <Text className="text-foreground font-semibold text-base">{currentStudio.name}</Text>
      </View>
    ) : null
  }

  return (
    <>
      <TouchableOpacity
        className="flex-row items-center"
        onPress={() => setShowPicker(true)}
      >
        <Text className="text-lg mr-1.5">
          {currentStudio ? (disciplineEmoji[currentStudio.discipline] ?? '\uD83C\uDFE2') : '\uD83C\uDFE2'}
        </Text>
        <Text className="text-foreground font-semibold text-base">
          {currentStudio?.name ?? 'Select Studio'}
        </Text>
        <Text className="text-muted ml-1">{'\u25BC'}</Text>
      </TouchableOpacity>

      <Modal
        visible={showPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPicker(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-card rounded-t-3xl px-4 pt-6 pb-8">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-foreground">Switch Studio</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Text className="text-primary font-medium">Done</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={studios}
              keyExtractor={s => s.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className={`flex-row items-center p-4 rounded-xl mb-2 border ${
                    item.id === currentStudio?.id ? 'bg-primary/5 border-primary/30' : 'bg-background border-border'
                  }`}
                  onPress={() => selectStudio(item)}
                >
                  <Text className="text-2xl mr-3">
                    {disciplineEmoji[item.discipline] ?? '\uD83C\uDFE2'}
                  </Text>
                  <View className="flex-1">
                    <Text className="text-foreground font-semibold">{item.name}</Text>
                    <Text className="text-muted text-sm capitalize">{item.role}</Text>
                  </View>
                  {item.id === currentStudio?.id && (
                    <Text className="text-primary font-bold">&#x2713;</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  )
}
