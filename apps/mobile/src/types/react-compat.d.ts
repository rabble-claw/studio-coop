/**
 * Fix TS2786 errors caused by @types/react@19 being resolved alongside @types/react@18
 * in the pnpm monorepo.
 *
 * Issue 1: React 19 adds `bigint` to ReactNode, but React 18 types don't include it.
 * Issue 2: React 19 removes `refs` from Component class, causing structural incompatibility
 *          with React 18's JSXElementConstructor which requires Component<any, any> (with refs).
 *
 * See: https://github.com/DefinitelyTyped/DefinitelyTyped/issues/69006
 */
import 'react'

declare module 'react' {
  // Makes bigint assignable to ReactNode in React 18,
  // matching the React 19 definition.
  interface DO_NOT_USE_OR_YOU_WILL_BE_FIRED_EXPERIMENTAL_REACT_NODES {
    bigint: bigint
  }
}

// Override @expo/vector-icons to use compatible types
declare module '@expo/vector-icons' {
  import { ComponentProps } from 'react'
  import { TextProps } from 'react-native'

  interface IconProps extends TextProps {
    name: string
    size?: number
    color?: string
  }

  export class Ionicons extends React.Component<IconProps> {
    render(): ReactNode
  }

  export class MaterialIcons extends React.Component<IconProps> {
    render(): ReactNode
  }

  export class FontAwesome extends React.Component<IconProps> {
    render(): ReactNode
  }

  export class MaterialCommunityIcons extends React.Component<IconProps> {
    render(): ReactNode
  }

  export class Feather extends React.Component<IconProps> {
    render(): ReactNode
  }

  export class AntDesign extends React.Component<IconProps> {
    render(): ReactNode
  }

  export class Entypo extends React.Component<IconProps> {
    render(): ReactNode
  }

  export class EvilIcons extends React.Component<IconProps> {
    render(): ReactNode
  }

  export class FontAwesome5 extends React.Component<IconProps> {
    render(): ReactNode
  }

  export class FontAwesome6 extends React.Component<IconProps> {
    render(): ReactNode
  }

  export class Fontisto extends React.Component<IconProps> {
    render(): ReactNode
  }

  export class Foundation extends React.Component<IconProps> {
    render(): ReactNode
  }

  export class Octicons extends React.Component<IconProps> {
    render(): ReactNode
  }

  export class SimpleLineIcons extends React.Component<IconProps> {
    render(): ReactNode
  }

  export class Zocial extends React.Component<IconProps> {
    render(): ReactNode
  }
}

// Override expo-camera to use compatible types
declare module 'expo-camera' {
  import { ViewProps } from 'react-native'

  export type CameraType = 'front' | 'back'
  export type FlashMode = 'off' | 'on' | 'auto' | 'torch'
  export type BarcodeScanningResult = {
    type: string
    data: string
    bounds?: { origin: { x: number; y: number }; size: { width: number; height: number } }
  }

  export interface CameraViewProps extends ViewProps {
    facing?: CameraType
    flash?: FlashMode
    enableTorch?: boolean
    zoom?: number
    className?: string
    onBarcodeScanned?: (result: BarcodeScanningResult) => void
  }

  export class CameraView extends React.Component<CameraViewProps> {
    takePictureAsync(options?: {
      quality?: number
      base64?: boolean
      exif?: boolean
    }): Promise<{ uri: string; width: number; height: number; base64?: string }>
    render(): ReactNode
  }

  export function useCameraPermissions(): [
    { granted: boolean; canAskAgain: boolean; status: string } | null,
    () => Promise<{ granted: boolean; canAskAgain: boolean; status: string }>
  ]
}
