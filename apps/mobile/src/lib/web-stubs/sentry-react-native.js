// Web stub for @sentry/react-native
const noop = () => {}
const wrap = (component) => component

module.exports = {
  init: noop,
  captureException: noop,
  captureMessage: noop,
  setUser: noop,
  wrap,
  withScope: (cb) => cb({ setExtra: noop, setTag: noop }),
  Severity: { Error: 'error', Warning: 'warning', Info: 'info' },
  ReactNavigationInstrumentation: class { registerNavigationContainer() {} },
  ReactNativeTracing: class {},
}
