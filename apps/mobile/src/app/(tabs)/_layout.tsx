import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useStudioSwitcher, StudioSwitcherHeader } from '@/components/studio-switcher'

export default function TabsLayout() {
  const switcher = useStudioSwitcher()

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#faf8f5' },
        headerTintColor: '#1a1a1a',
        headerTitleStyle: { fontWeight: '600' },
        tabBarStyle: { backgroundColor: '#faf8f5', borderTopColor: '#e5ddd5' },
        tabBarActiveTintColor: '#e85d4a',
        tabBarInactiveTintColor: '#6b6560',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: () => (
            <StudioSwitcherHeader {...switcher} />
          ),
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="studio"
        options={{
          title: 'Studio',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
          href: null, // Hidden from tab bar, navigated to from home
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          headerTitle: () => (
            <StudioSwitcherHeader {...switcher} />
          ),
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="class"
        options={{
          title: 'Class',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
          href: null, // Hidden, navigated to from studio
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}
