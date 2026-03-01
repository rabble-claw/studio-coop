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
import * as Location from 'expo-location'
import { discoverApi } from '@/lib/api'

type StudioCard = {
  id: string
  name: string
  slug: string
  discipline: string
  description: string | null
  logo_url: string | null
  city: string | null
  country_code: string | null
  region: string | null
  distance_km: number | null
  member_count: number
  upcoming_class_count: number
}

type LocationEntry = {
  country_code: string
  regions: string[]
  cities: string[]
}

type BrowseMode = 'near_me' | 'by_location' | 'by_type'

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

const COUNTRY_INFO: Record<string, { flag: string; name: string }> = {
  NZ: { flag: '\u{1F1F3}\u{1F1FF}', name: 'New Zealand' },
  US: { flag: '\u{1F1FA}\u{1F1F8}', name: 'United States' },
  AU: { flag: '\u{1F1E6}\u{1F1FA}', name: 'Australia' },
  GB: { flag: '\u{1F1EC}\u{1F1E7}', name: 'United Kingdom' },
  CA: { flag: '\u{1F1E8}\u{1F1E6}', name: 'Canada' },
}

function getCountryDisplay(code: string): { flag: string; name: string } {
  return COUNTRY_INFO[code] ?? { flag: '\u{1F3F3}\uFE0F', name: code }
}

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
  const [error, setError] = useState('')

  // Browse mode state
  const [mode, setMode] = useState<BrowseMode>('by_type')

  // Location mode state
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [locations, setLocations] = useState<LocationEntry[]>([])

  // Near Me state
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationPermission, setLocationPermission] = useState<'undetermined' | 'granted' | 'denied'>('undetermined')

  // Fetch available filters on mount
  useEffect(() => {
    discoverApi.filters()
      .then((data) => {
        setLocations(data.locations ?? [])
      })
      .catch(() => {}) // graceful -- filters are optional
  }, [])

  // Handle Near Me mode activation
  const requestLocationAndFetch = useCallback(async () => {
    if (locationPermission === 'granted' && userLocation) {
      // Already have permission and location, just fetch
      return
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setLocationPermission('denied')
        return
      }
      setLocationPermission('granted')

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      setUserLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      })
    } catch {
      setLocationPermission('denied')
    }
  }, [locationPermission, userLocation])

  // When mode changes to near_me, request location
  useEffect(() => {
    if (mode === 'near_me') {
      requestLocationAndFetch()
    }
  }, [mode, requestLocationAndFetch])

  const fetchStudios = useCallback(async () => {
    setError('')
    try {
      const params = new URLSearchParams()

      // Search applies to all modes
      if (search.trim()) params.set('q', search.trim())
      params.set('limit', '30')

      if (mode === 'by_type') {
        if (discipline !== 'All') params.set('discipline', discipline.toLowerCase())
      } else if (mode === 'by_location') {
        if (selectedCountry) params.set('country', selectedCountry)
        if (selectedRegion) params.set('region', selectedRegion)
      } else if (mode === 'near_me') {
        if (userLocation) {
          params.set('lat', String(userLocation.latitude))
          params.set('lng', String(userLocation.longitude))
          params.set('sort', 'distance')
        }
      }

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
  }, [discipline, search, mode, selectedCountry, selectedRegion, userLocation])

  useEffect(() => {
    // Don't fetch in near_me mode until we have location (or permission denied)
    if (mode === 'near_me' && locationPermission === 'undetermined') return

    setLoading(true)
    const timeout = setTimeout(fetchStudios, 300)
    return () => clearTimeout(timeout)
  }, [fetchStudios, mode, locationPermission])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchStudios()
  }, [fetchStudios])

  const handleModeChange = (newMode: BrowseMode) => {
    if (newMode === mode) return
    setMode(newMode)
    setStudios([])
    setLoading(true)
    // Reset mode-specific filters
    if (newMode === 'by_type') {
      setDiscipline('All')
    } else if (newMode === 'by_location') {
      setSelectedCountry(null)
      setSelectedRegion(null)
    }
  }

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
              {item.distance_km != null && (
                <Text style={{ fontSize: 12, color: '#7c3aed', fontWeight: '500' }}> · {item.distance_km.toFixed(1)} km</Text>
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

  // Mode tab button helper
  const ModeTab = ({ tabMode, label, icon }: { tabMode: BrowseMode; label: string; icon: string }) => {
    const isActive = mode === tabMode
    return (
      <TouchableOpacity
        onPress={() => handleModeChange(tabMode)}
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: isActive ? '#7c3aed' : 'transparent',
          gap: 6,
        }}
      >
        <Text style={{ fontSize: 16 }}>{icon}</Text>
        <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? '#fff' : '#9e8da8' }}>
          {label}
        </Text>
      </TouchableOpacity>
    )
  }

  // By Type filter section
  const ByTypeFilter = () => (
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
  )

  // By Location filter section
  const ByLocationFilter = () => {
    const selectedLocationEntry = locations.find(l => l.country_code === selectedCountry)

    return (
      <View style={{ paddingBottom: 8 }}>
        {/* Breadcrumb */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8, gap: 4 }}>
          <TouchableOpacity onPress={() => { setSelectedCountry(null); setSelectedRegion(null) }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: selectedCountry ? '#7c3aed' : '#9e8da8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              All Countries
            </Text>
          </TouchableOpacity>
          {selectedCountry && (
            <>
              <Text style={{ fontSize: 13, color: '#9e8da8' }}> {'>'} </Text>
              <TouchableOpacity onPress={() => setSelectedRegion(null)}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: selectedRegion ? '#7c3aed' : '#9e8da8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {getCountryDisplay(selectedCountry).flag} {getCountryDisplay(selectedCountry).name}
                </Text>
              </TouchableOpacity>
            </>
          )}
          {selectedRegion && (
            <>
              <Text style={{ fontSize: 13, color: '#9e8da8' }}> {'>'} </Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#9e8da8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {selectedRegion}
              </Text>
            </>
          )}
        </View>

        {/* Country pills (when no country selected) */}
        {!selectedCountry && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            {locations.map((loc) => {
              const display = getCountryDisplay(loc.country_code)
              return (
                <TouchableOpacity
                  key={loc.country_code}
                  onPress={() => { setSelectedCountry(loc.country_code); setSelectedRegion(null) }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    borderWidth: 1.5,
                    borderColor: '#e8e0ec',
                    backgroundColor: '#fff',
                    gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 16 }}>{display.flag}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#3d2e47' }}>
                    {display.name}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        )}

        {/* Region pills (when country selected, no region selected) */}
        {selectedCountry && !selectedRegion && selectedLocationEntry && selectedLocationEntry.regions.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            <TouchableOpacity
              onPress={() => setSelectedRegion(null)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: '#7c3aed',
                backgroundColor: '#7c3aed',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#fff' }}>
                All Regions
              </Text>
            </TouchableOpacity>
            {selectedLocationEntry.regions.map((r) => {
              const isActive = selectedRegion === r
              return (
                <TouchableOpacity
                  key={r}
                  onPress={() => setSelectedRegion(r)}
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
                    {r}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        )}
      </View>
    )
  }

  // Near Me content
  const NearMeStatus = () => {
    if (locationPermission === 'denied') {
      return (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e8e0ec', padding: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 24, marginBottom: 8 }}>{'\u{1F4CD}'}</Text>
            <Text style={{ fontSize: 14, color: '#9e8da8', textAlign: 'center' }}>
              Location permission denied. Enable in Settings.
            </Text>
          </View>
        </View>
      )
    }

    if (locationPermission === 'undetermined' || (locationPermission === 'granted' && !userLocation)) {
      return (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, alignItems: 'center' }}>
          <ActivityIndicator size="small" color="#7c3aed" />
          <Text style={{ fontSize: 13, color: '#9e8da8', marginTop: 8 }}>
            Getting your location...
          </Text>
        </View>
      )
    }

    return null
  }

  const getResultsSummary = () => {
    const parts: string[] = [`${studios.length} studio${studios.length !== 1 ? 's' : ''}`]
    if (mode === 'by_type' && discipline !== 'All') parts.push(discipline)
    if (mode === 'by_location') {
      if (selectedRegion) parts.push(selectedRegion)
      else if (selectedCountry) parts.push(getCountryDisplay(selectedCountry).name)
    }
    if (mode === 'near_me') parts.push('nearby')
    return parts.join(' · ')
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

      {/* Mode tabs */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', backgroundColor: '#f0eaf3', borderRadius: 14, padding: 3 }}>
          <ModeTab tabMode="near_me" label="Near Me" icon={'\u{1F9ED}'} />
          <ModeTab tabMode="by_location" label="By Location" icon={'\u{1F30D}'} />
          <ModeTab tabMode="by_type" label="By Type" icon={'\u{2B50}'} />
        </View>
      </View>

      {/* Mode-specific filters */}
      {mode === 'by_type' && <ByTypeFilter />}
      {mode === 'by_location' && <ByLocationFilter />}
      {mode === 'near_me' && <NearMeStatus />}

      {/* Results header */}
      {!loading && studios.length > 0 && (
        <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}>
          <Text style={{ fontSize: 13, color: '#9e8da8' }}>
            {getResultsSummary()}
          </Text>
        </View>
      )}
    </View>
  )

  // Determine empty state message
  const getEmptyMessage = () => {
    if (mode === 'near_me' && locationPermission === 'denied') {
      return 'Enable location access to find studios near you.'
    }
    if (search || (mode === 'by_type' && discipline !== 'All') || (mode === 'by_location' && (selectedCountry || selectedRegion))) {
      return 'No studios found matching your search.'
    }
    return 'No studios available yet. Check back soon!'
  }

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
                    {getEmptyMessage()}
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
