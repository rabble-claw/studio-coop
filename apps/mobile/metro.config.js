const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [monorepoRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

// Force single React instance in pnpm monorepo.
//
// Problem: pnpm's virtual store (.pnpm/) resolves React differently per
// package. expo-router, expo-modules-core, and nativewind each have their
// own node_modules/react symlink inside the .pnpm directory, which can
// point to react@19.2.4 (from the web app) instead of react@18.3.1 (what
// mobile needs). extraNodeModules doesn't help because pnpm packages
// resolve from their own virtual store node_modules first. Two React
// instances → hooks fail → "Cannot read property useMemo of null".
//
// Solution: Custom resolveRequest that intercepts 'react' and
// 'react-native' imports and returns the app's copy directly.
// Pre-resolve the exact file paths for React modules at config time.
// These are the modules that MUST be singletons.
const reactResolves = {}
for (const mod of ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime']) {
  reactResolves[mod] = require.resolve(mod, { paths: [projectRoot] })
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Redirect React imports to app's React 18 (exact match only)
  if (reactResolves[moduleName]) {
    return { type: 'sourceFile', filePath: reactResolves[moduleName] }
  }
  // Default resolution
  return context.resolveRequest(
    { ...context, resolveRequest: undefined },
    moduleName,
    platform,
  )
}

module.exports = withNativeWind(config, { input: './global.css' })
