// Stub for @stripe/stripe-react-native on web platform.
// The real Stripe RN SDK imports native-only modules that crash Metro web bundling.
const noop = () => {}
const noopComponent = () => null

module.exports = {
  StripeProvider: noopComponent,
  useStripe: () => ({
    initPaymentSheet: noop,
    presentPaymentSheet: noop,
    confirmPaymentSheetPayment: noop,
    createToken: noop,
    createPaymentMethod: noop,
    handleNextAction: noop,
    confirmPayment: noop,
    isApplePaySupported: false,
    isGooglePaySupported: false,
  }),
  usePaymentSheet: () => ({
    initPaymentSheet: noop,
    presentPaymentSheet: noop,
    loading: false,
  }),
  CardField: noopComponent,
  CardForm: noopComponent,
  ApplePayButton: noopComponent,
  GooglePayButton: noopComponent,
}
