import * as Sentry from '@sentry/react-native'

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN

let initialized = false

export function initSentry() {
  if (initialized || !DSN) return
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,
    environment: __DEV__ ? 'development' : 'production',
  })
  initialized = true
}

export function captureException(error: unknown) {
  if (!DSN) return
  Sentry.captureException(error)
}

export function setUser(user: { id: string; email?: string } | null) {
  if (!DSN) return
  Sentry.setUser(user)
}

export { Sentry }
