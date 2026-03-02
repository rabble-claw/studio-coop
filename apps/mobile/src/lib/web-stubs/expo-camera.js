// Web stub for expo-camera
const noop = () => {}
const noopComponent = () => null

module.exports = {
  CameraView: noopComponent,
  Camera: noopComponent,
  useCameraPermissions: () => [{ granted: false, status: 'undetermined' }, noop],
  CameraType: { back: 'back', front: 'front' },
  FlashMode: { off: 'off', on: 'on', auto: 'auto' },
}
