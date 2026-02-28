import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { Link } from 'expo-router'
import { useAuth } from '@/lib/auth-context'

export default function SignUpScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const { signUp } = useAuth()

  async function handleSignUp() {
    setLoading(true)
    setError('')
    setMessage('')
    const { error } = await signUp(email, password, name.trim() || undefined)
    if (error) {
      setError(error.message)
    } else {
      setMessage('Check your email to confirm your account!')
    }
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
        <View className="items-center mb-10">
          <View className="w-16 h-16 bg-primary rounded-2xl items-center justify-center mb-4">
            <Text className="text-white text-2xl font-bold">SC</Text>
          </View>
          <Text className="text-3xl font-bold text-foreground">Create Account</Text>
          <Text className="text-muted mt-1">Join your studio community</Text>
        </View>

        <View className="space-y-4">
          <View>
            <TextInput
              className="bg-card border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="Full Name"
              placeholderTextColor="#6b6560"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>
          <View className="mt-3">
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
              placeholder="Password (min 6 characters)"
              placeholderTextColor="#6b6560"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {error ? <Text className="text-red-500 text-sm mt-2">{error}</Text> : null}
          {message ? <Text className="text-green-600 text-sm mt-2">{message}</Text> : null}

          <TouchableOpacity
            className="bg-primary rounded-xl py-4 items-center mt-4"
            onPress={handleSignUp}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-base">
              {loading ? 'Creating account...' : 'Create account'}
            </Text>
          </TouchableOpacity>

          <View className="items-center mt-4">
            <Link href="/auth/sign-in" asChild>
              <TouchableOpacity>
                <Text className="text-primary">Already have an account? Sign in</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
