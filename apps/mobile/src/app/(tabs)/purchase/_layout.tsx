import { Stack } from 'expo-router'

export default function PurchaseLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#faf8f5' },
        headerTintColor: '#1a1a1a',
        headerTitleStyle: { fontWeight: '600' },
      }}
    />
  )
}
