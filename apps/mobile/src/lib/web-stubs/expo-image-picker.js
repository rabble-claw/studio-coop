// Web stub for expo-image-picker
module.exports = {
  launchImageLibraryAsync: async () => ({ canceled: true, assets: [] }),
  launchCameraAsync: async () => ({ canceled: true, assets: [] }),
  requestMediaLibraryPermissionsAsync: async () => ({ status: 'undetermined', granted: false }),
  requestCameraPermissionsAsync: async () => ({ status: 'undetermined', granted: false }),
  MediaTypeOptions: { All: 'All', Images: 'Images', Videos: 'Videos' },
  ImagePickerResult: {},
}
