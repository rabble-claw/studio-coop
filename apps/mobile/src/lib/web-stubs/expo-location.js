// Web stub for expo-location
export const requestForegroundPermissionsAsync = async () => ({ status: 'denied' })
export const getCurrentPositionAsync = async () => { throw new Error('Location not available on web') }
export const Accuracy = { Balanced: 3 }
export default { requestForegroundPermissionsAsync, getCurrentPositionAsync, Accuracy }
