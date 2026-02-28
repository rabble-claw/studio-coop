import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { Link } from 'expo-router'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

export default function SignInScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn } = useAuth()

  // Forgot password state
  const [forgotMode, setForgotMode] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState('')
  const [resetError, setResetError] = useState('')

  async function handleSignIn() {
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleResetPassword() {
    if (!resetEmail.trim()) {
      setResetError('Please enter your email address')
      return
    }
    setResetLoading(true)
    setResetError('')
    setResetMessage('')
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail)
    if (error) {
      setResetError(error.message)
    } else {
      setResetMessage('Check your email for a password reset link')
    }
    setResetLoading(false)
  }

  function enterForgotMode() {
    setForgotMode(true)
    setResetEmail(email)
    setResetError('')
    setResetMessage('')
  }

  function exitForgotMode() {
    setForgotMode(false)
    setResetError('')
    setResetMessage('')
  }

  if (forgotMode) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-background">
        <ScrollView contentContainerStyle={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
          <View className="items-center mb-10">
            <View className="w-16 h-16 bg-primary rounded-2xl items-center justify-center mb-4">
              <Text className="text-white text-2xl font-bold">SC</Text>
            </View>
            <Text className="text-3xl font-bold text-foreground">Reset Password</Text>
            <Text className="text-muted mt-1">We'll send you a reset link</Text>
          </View>

          <View className="space-y-4">
            <View>
              <TextInput
                className="bg-card border border-border rounded-xl px-4 py-3 text-foreground"
                placeholder="Email"
                placeholderTextColor="#6b6560"
                value={resetEmail}
                onChangeText={setResetEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
              />
            </View>

            {resetError ? (
              <Text className="text-red-500 text-sm mt-2">{resetError}</Text>
            ) : null}
            {resetMessage ? (
              <Text className="text-green-600 text-sm mt-2">{resetMessage}</Text>
            ) : null}

            <TouchableOpacity
              className="bg-primary rounded-xl py-4 items-center mt-4"
              onPress={handleResetPassword}
              disabled={resetLoading}
              activeOpacity={0.8}
            >
              <Text className="text-white font-semibold text-base">
                {resetLoading ? 'Sending...' : 'Send Reset Link'}
              </Text>
            </TouchableOpacity>

            <View className="items-center mt-4">
              <TouchableOpacity onPress={exitForgotMode}>
                <Text className="text-primary">Back to sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
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

          <View className="items-end mt-1">
            <TouchableOpacity onPress={enterForgotMode}>
              <Text className="text-primary text-sm">Forgot password?</Text>
            </TouchableOpacity>
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
            <Link href="/auth/sign-up" asChild>
              <TouchableOpacity>
                <Text className="text-primary">Don&apos;t have an account? Sign up</Text>
              </TouchableOpacity>
            </Link>
          </View>
          <View className="items-center mt-3">
            <Link href="/(public)/explore" asChild>
              <TouchableOpacity>
                <Text className="text-muted">Browse Studios</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
