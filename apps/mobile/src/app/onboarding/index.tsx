import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

const DISCIPLINES = [
  { value: 'pole', label: 'Pole' },
  { value: 'bjj', label: 'BJJ' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'crossfit', label: 'CrossFit' },
  { value: 'cycling', label: 'Cycling' },
  { value: 'pilates', label: 'Pilates' },
  { value: 'dance', label: 'Dance' },
  { value: 'aerial', label: 'Aerial' },
  { value: 'boxing', label: 'Boxing' },
  { value: 'barre', label: 'Barre' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'martial_arts', label: 'Martial Arts' },
  { value: 'other', label: 'Other' },
]

type Mode = 'choose' | 'create' | 'join'

export default function OnboardingScreen() {
  const { user, signOut, refreshStudio } = useAuth()
  const [mode, setMode] = useState<Mode>('choose')

  // Create studio state
  const [studioName, setStudioName] = useState('')
  const [discipline, setDiscipline] = useState('')
  const [creating, setCreating] = useState(false)

  // Join studio state
  const [inviteCode, setInviteCode] = useState('')
  const [joining, setJoining] = useState(false)

  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'my-studio'
  }

  async function handleCreateStudio() {
    if (!studioName.trim() || !discipline || !user) return
    setCreating(true)

    try {
      const slug = generateSlug(studioName)

      // Check slug uniqueness
      const { data: existing } = await supabase
        .from('studios')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()

      const finalSlug = existing
        ? `${slug}-${Date.now().toString(36)}`
        : slug

      // Create studio
      const { data: studio, error: studioError } = await supabase
        .from('studios')
        .insert({
          name: studioName.trim(),
          slug: finalSlug,
          discipline,
          tier: 'free',
          timezone: 'UTC',
          settings: {},
        })
        .select('id')
        .single()

      if (studioError || !studio) {
        throw new Error(studioError?.message ?? 'Failed to create studio')
      }

      // Create owner membership
      const { error: memberError } = await supabase
        .from('memberships')
        .insert({
          user_id: user.id,
          studio_id: studio.id,
          role: 'owner',
          status: 'active',
        })

      if (memberError) {
        throw new Error(memberError.message)
      }

      // Refresh auth context to pick up the new studioId — AuthGate will redirect
      await refreshStudio()
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create studio')
    } finally {
      setCreating(false)
    }
  }

  async function handleJoinStudio() {
    if (!inviteCode.trim() || !user) return
    setJoining(true)

    try {
      const code = inviteCode.trim().toLowerCase()

      // Try to find studio by slug or partial URL
      const slug = code.includes('/') ? code.split('/').pop()! : code

      const { data: studio, error } = await supabase
        .from('studios')
        .select('id, name')
        .eq('slug', slug)
        .maybeSingle()

      if (error || !studio) {
        Alert.alert('Not Found', 'No studio found with that code. Check with your studio and try again.')
        setJoining(false)
        return
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from('memberships')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('studio_id', studio.id)
        .maybeSingle()

      if (existing?.status === 'active') {
        Alert.alert('Already Joined', `You're already a member of ${studio.name}.`)
        await refreshStudio()
        return
      }

      if (existing) {
        // Reactivate
        await supabase
          .from('memberships')
          .update({ status: 'active' })
          .eq('id', existing.id)
      } else {
        // Create new membership
        const { error: joinError } = await supabase
          .from('memberships')
          .insert({
            user_id: user.id,
            studio_id: studio.id,
            role: 'member',
            status: 'active',
          })

        if (joinError) {
          throw new Error(joinError.message)
        }
      }

      await refreshStudio()
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to join studio')
    } finally {
      setJoining(false)
    }
  }

  if (mode === 'choose') {
    return (
      <View className="flex-1 bg-background justify-center px-6">
        <View className="items-center mb-10">
          <Text className="text-5xl mb-4">{"🏋️"}</Text>
          <Text className="text-2xl font-bold text-foreground text-center">Welcome to Studio Co-op</Text>
          <Text className="text-muted text-center mt-2">
            Get started by joining your studio or creating a new one.
          </Text>
        </View>

        <TouchableOpacity
          className="bg-primary rounded-xl py-4 px-6 mb-4"
          onPress={() => setMode('join')}
        >
          <Text className="text-primary-foreground text-center font-semibold text-lg">
            Join a Studio
          </Text>
          <Text className="text-primary-foreground/70 text-center text-sm mt-1">
            Enter your studio's code or URL
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="border border-border rounded-xl py-4 px-6 mb-8"
          onPress={() => setMode('create')}
        >
          <Text className="text-foreground text-center font-semibold text-lg">
            Create a Studio
          </Text>
          <Text className="text-muted text-center text-sm mt-1">
            Set up a new studio for your community
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={signOut}>
          <Text className="text-muted text-center text-sm">Sign out</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (mode === 'join') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-background"
      >
        <View className="flex-1 justify-center px-6">
          <TouchableOpacity onPress={() => setMode('choose')} className="mb-6">
            <Text className="text-primary text-base">Back</Text>
          </TouchableOpacity>

          <Text className="text-2xl font-bold text-foreground mb-2">Join a Studio</Text>
          <Text className="text-muted mb-6">
            Enter the studio code or URL your studio shared with you.
          </Text>

          <TextInput
            className="bg-card border border-border rounded-xl px-4 py-3 text-foreground text-base mb-4"
            placeholder="e.g. my-studio or studio.coop/my-studio"
            placeholderTextColor="#999"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            className={`rounded-xl py-4 ${inviteCode.trim() && !joining ? 'bg-primary' : 'bg-muted/30'}`}
            onPress={handleJoinStudio}
            disabled={!inviteCode.trim() || joining}
          >
            <Text className={`text-center font-semibold text-lg ${inviteCode.trim() && !joining ? 'text-primary-foreground' : 'text-muted'}`}>
              {joining ? 'Joining...' : 'Join Studio'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    )
  }

  // mode === 'create'
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingTop: 60 }}>
        <TouchableOpacity onPress={() => setMode('choose')} className="mb-6">
          <Text className="text-primary text-base">Back</Text>
        </TouchableOpacity>

        <Text className="text-2xl font-bold text-foreground mb-2">Create a Studio</Text>
        <Text className="text-muted mb-6">
          Set up your studio in seconds. You can customize everything later.
        </Text>

        <Text className="text-sm font-medium text-foreground mb-1">Studio Name</Text>
        <TextInput
          className="bg-card border border-border rounded-xl px-4 py-3 text-foreground text-base mb-4"
          placeholder="e.g. Sunset Pole Studio"
          placeholderTextColor="#999"
          value={studioName}
          onChangeText={setStudioName}
        />

        <Text className="text-sm font-medium text-foreground mb-2">Discipline</Text>
        <View className="flex-row flex-wrap gap-2 mb-6">
          {DISCIPLINES.map((d) => (
            <TouchableOpacity
              key={d.value}
              className={`px-4 py-2 rounded-full border ${
                discipline === d.value
                  ? 'bg-primary border-primary'
                  : 'border-border bg-card'
              }`}
              onPress={() => setDiscipline(d.value)}
            >
              <Text className={discipline === d.value ? 'text-primary-foreground font-medium' : 'text-foreground'}>
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          className={`rounded-xl py-4 ${studioName.trim() && discipline && !creating ? 'bg-primary' : 'bg-muted/30'}`}
          onPress={handleCreateStudio}
          disabled={!studioName.trim() || !discipline || creating}
        >
          <Text className={`text-center font-semibold text-lg ${studioName.trim() && discipline && !creating ? 'text-primary-foreground' : 'text-muted'}`}>
            {creating ? 'Creating...' : 'Create Studio'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
