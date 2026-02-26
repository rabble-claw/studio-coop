import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { Link } from 'expo-router'
import { useAuth } from '@/lib/auth-context'

export default function SignInScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn } = useAuth()

  async function handleSignIn() {
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-background">
      <ScrollView contentContainerClassName="flex-1 justify-center px-6">
        <View className="items-center mb-10">
          <View className="w-16 h-16 bg-primary rounded-2xl items-center justify-center mb-4">
            <Text className="text-white text-2xl font-bold">SC</Text>
          </View>
          <Text className="text-3xl font-bold text-foreground">Studio Co-op</Text>
          <Text className="text-muted mt-1">Your studio community awaits</Text>
        </View>

        <View className="space-y-4">
          <View>
            <TextInput
              className="bg-card border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="Email"
              placeholderTextColor="#6b6560"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <View className="mt-3">
            <TextInput
              className="bg-card border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="Password"
              placeholderTextColor="#6b6560"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {error ? (
            <Text className="text-red-500 text-sm mt-2">{error}</Text>
          ) : null}

          <TouchableOpacity
            className="bg-primary rounded-xl py-4 items-center mt-4"
            onPress={handleSignIn}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-base">
              {loading ? 'Signing in...' : 'Sign in'}
            </Text>
          </TouchableOpacity>

          <View className="items-center mt-4">
            <Link href="/auth/sign-up">
              <Text className="text-primary">Don&apos;t have an account? Sign up</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
