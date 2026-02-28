import { Stack, useRouter } from 'expo-router'
import { TouchableOpacity, Text } from 'react-native'

export default function PublicLayout() {
  const router = useRouter()

  return (
    <Stack
      screenOptions={{
        headerRight: () => (
          <TouchableOpacity onPress={() => router.push('/auth/sign-in')}>
            <Text className="text-primary font-medium text-base mr-2">Sign In</Text>
          </TouchableOpacity>
        ),
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#3d2e47',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="explore" options={{ title: 'Explore Studios' }} />
      <Stack.Screen name="studio/[slug]" options={{ title: '' }} />
    </Stack>
  )
}
