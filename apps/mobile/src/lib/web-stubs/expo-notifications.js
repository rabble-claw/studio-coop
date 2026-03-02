// Web stub for expo-notifications
const noop = () => {}
const noopAsync = async () => ({ status: 'undetermined' })

module.exports = {
  setNotificationHandler: noop,
  getPermissionsAsync: noopAsync,
  requestPermissionsAsync: noopAsync,
  getExpoPushTokenAsync: async () => ({ data: '' }),
  addNotificationResponseReceivedListener: () => ({ remove: noop }),
  getLastNotificationResponseAsync: async () => null,
  scheduleNotificationAsync: noopAsync,
  cancelAllScheduledNotificationsAsync: noopAsync,
  setBadgeCountAsync: noopAsync,
  getBadgeCountAsync: async () => 0,
  AndroidImportance: { DEFAULT: 3, HIGH: 4, MAX: 5 },
}
