import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { discoverApi } from '@/lib/api'

type StudioCard = {
  id: string
  name: string
  slug: string
  discipline: string
  description: string | null
  logo_url: string | null
  city: string | null
  member_count: number
  upcoming_class_count: number
}

// Visual identity for each discipline
const DISCIPLINE_META: Record<string, { emoji: string; color: string; bg: string }> = {
  pole:    { emoji: '\u{1FA70}', color: '#7c3aed', bg: '#f3e8ff' },
  aerial:  { emoji: '\u{1F3AA}', color: '#2563eb', bg: '#dbeafe' },
  yoga:    { emoji: '\u{1F9D8}', color: '#059669', bg: '#d1fae5' },
  dance:   { emoji: '\u{1F483}', color: '#db2777', bg: '#fce7f3' },
  bjj:     { emoji: '\u{1F94B}', color: '#ea580c', bg: '#ffedd5' },
  pilates: { emoji: '\u{1F9D8}\u200D\u2640\uFE0F', color: '#0891b2', bg: '#cffafe' },
  fitness: { emoji: '\u{1F3CB}\uFE0F', color: '#4f46e5', bg: '#e0e7ff' },
}

const DISCIPLINES = ['All', 'Pole', 'Aerial', 'Yoga', 'Dance', 'BJJ', 'Pilates', 'Fitness']

function getDisciplineMeta(discipline: string) {
  return DISCIPLINE_META[discipline.toLowerCase()] ?? { emoji: '\u{2B50}', color: '#7c3aed', bg: '#f3e8ff' }
}

export default function ExploreScreen() {
  const router = useRouter()
  const [studios, setStudios] = useState<StudioCard[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [discipline, setDiscipline] = useState('All')
  const [city, setCity] = useState('All')
  const [cities, setCities] = useState<string[]>([])
  const [error, setError] = useState('')

  // Fetch available cities on mount
  useEffect(() => {
    discoverApi.filters()
      .then((data) => setCities(data.cities ?? []))
      .catch(() => {}) // graceful — cities are optional
  }, [])

  const fetchStudios = useCallback(async () => {
    setError('')
    try {
      const params = new URLSearchParams()
      if (discipline !== 'All') params.set('discipline', discipline.toLowerCase())
      if (city !== 'All') params.set('city', city)
      if (search.trim()) params.set('q', search.trim())
      params.set('limit', '30')
      const qs = params.toString()
      const data = await discoverApi.studios(qs ? `?${qs}` : '')
      setStudios(data.studios)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not load studios'
      setError(message || 'Could not load studios')
      setStudios([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [discipline, city, search])

  useEffect(() => {
    setLoading(true)
    const timeout = setTimeout(fetchStudios, 300)
    return () => clearTimeout(timeout)
  }, [fetchStudios])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchStudios()
  }, [fetchStudios])

  const renderStudioCard = ({ item }: { item: StudioCard }) => {
    const meta = getDisciplineMeta(item.discipline)
    return (
      <TouchableOpacity
        style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e8e0ec', overflow: 'hidden' }}
        activeOpacity={0.7}
        onPress={() => router.push(`/(public)/studio/${item.slug}`)}
      >
        {/* Colored discipline accent bar */}
        <View style={{ height: 4, backgroundColor: meta.color }} />
        <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center' }}>
          {item.logo_url ? (
            <Image
              source={{ uri: item.logo_url }}
              style={{ width: 56, height: 56, borderRadius: 12, marginRight: 12 }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ width: 56, height: 56, borderRadius: 12, marginRight: 12, backgroundColor: meta.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 24 }}>{meta.emoji}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#3d2e47' }}>{item.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <Text style={{ fontSize: 12, color: '#9e8da8', textTransform: 'capitalize' }}>{item.discipline}</Text>
              {item.city && (
                <Text style={{ fontSize: 12, color: '#9e8da8' }}> · {item.city}</Text>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Text style={{ fontSize: 12, color: '#9e8da8' }}>
                {item.member_count} member{item.member_count !== 1 ? 's' : ''}
              </Text>
              {item.upcoming_class_count > 0 && (
                <Text style={{ fontSize: 12, color: '#9e8da8' }}>
                  {' '}· {item.upcoming_class_count} class{item.upcoming_class_count !== 1 ? 'es' : ''}
                </Text>
              )}
            </View>
          </View>
          <Text style={{ fontSize: 20, color: '#c4b8cc', marginLeft: 8 }}>{'\u203A'}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  const ListHeader = () => (
    <View>
      {/* Search bar */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <TextInput
          style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8e0ec', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#3d2e47' }}
          placeholder="Search studios..."
          placeholderTextColor="#9e8da8"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Discipline filter — visual cards */}
      <View style={{ paddingBottom: 8 }}>
        <Text style={{ paddingHorizontal: 16, fontSize: 13, fontWeight: '600', color: '#9e8da8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          By Type
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          <TouchableOpacity
            onPress={() => setDiscipline('All')}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              borderWidth: 1.5,
              borderColor: discipline === 'All' ? '#7c3aed' : '#e8e0ec',
              backgroundColor: discipline === 'All' ? '#7c3aed' : '#fff',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '500', color: discipline === 'All' ? '#fff' : '#3d2e47' }}>
              All
            </Text>
          </TouchableOpacity>
          {DISCIPLINES.filter(d => d !== 'All').map((d) => {
            const meta = getDisciplineMeta(d)
            const isActive = discipline === d
            return (
              <TouchableOpacity
                key={d}
                onPress={() => setDiscipline(d)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: isActive ? meta.color : '#e8e0ec',
                  backgroundColor: isActive ? meta.bg : '#fff',
                  gap: 6,
                }}
              >
                <Text style={{ fontSize: 16 }}>{meta.emoji}</Text>
                <Text style={{ fontSize: 14, fontWeight: '500', color: isActive ? meta.color : '#3d2e47' }}>
                  {d}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      {/* City filter */}
      {cities.length > 0 && (
        <View style={{ paddingBottom: 12 }}>
          <Text style={{ paddingHorizontal: 16, fontSize: 13, fontWeight: '600', color: '#9e8da8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            By City
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            <TouchableOpacity
              onPress={() => setCity('All')}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: city === 'All' ? '#7c3aed' : '#e8e0ec',
                backgroundColor: city === 'All' ? '#7c3aed' : '#fff',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '500', color: city === 'All' ? '#fff' : '#3d2e47' }}>
                All Cities
              </Text>
            </TouchableOpacity>
            {cities.map((c) => {
              const isActive = city === c
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCity(c)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    borderWidth: 1.5,
                    borderColor: isActive ? '#7c3aed' : '#e8e0ec',
                    backgroundColor: isActive ? '#f3e8ff' : '#fff',
                    gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 14 }}>{'\u{1F4CD}'}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: isActive ? '#7c3aed' : '#3d2e47' }}>
                    {c}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      )}

      {/* Results header */}
      {!loading && studios.length > 0 && (
        <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}>
          <Text style={{ fontSize: 13, color: '#9e8da8' }}>
            {studios.length} studio{studios.length !== 1 ? 's' : ''}
            {discipline !== 'All' ? ` · ${discipline}` : ''}
            {city !== 'All' ? ` · ${city}` : ''}
          </Text>
        </View>
      )}
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: '#faf7f5' }}>
      {loading && studios.length === 0 ? (
        <>
          <ListHeader />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#7c3aed" />
          </View>
        </>
      ) : (
        <FlatList
          data={studios}
          keyExtractor={(item) => item.id}
          renderItem={renderStudioCard}
          ListHeaderComponent={ListHeader}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7c3aed" />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 32 }}>
              {error ? (
                <>
                  <Text style={{ fontSize: 32, marginBottom: 12 }}>{'\u{1F50C}'}</Text>
                  <Text style={{ color: '#9e8da8', fontSize: 15, textAlign: 'center', marginBottom: 12 }}>
                    Could not connect to the server.
                  </Text>
                  <TouchableOpacity
                    onPress={() => { setLoading(true); fetchStudios() }}
                    style={{ backgroundColor: '#7c3aed', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Try Again</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 32, marginBottom: 12 }}>{'\u{1F3AA}'}</Text>
                  <Text style={{ color: '#9e8da8', fontSize: 15, textAlign: 'center' }}>
                    {search || discipline !== 'All' || city !== 'All'
                      ? 'No studios found matching your search.'
                      : 'No studios available yet. Check back soon!'}
                  </Text>
                </>
              )}
            </View>
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  )
}
