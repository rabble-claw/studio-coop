import { build } from 'esbuild'

// Node built-ins that Workers provides via nodejs_compat
const nodeBuiltins = [
  'node:assert', 'node:buffer', 'node:crypto', 'node:events',
  'node:module', 'node:path', 'node:stream', 'node:url', 'node:util',
  'node:zlib', 'node:net', 'node:tls', 'node:http', 'node:https',
  'node:worker_threads', 'node:string_decoder', 'node:querystring',
  'assert', 'buffer', 'crypto', 'events', 'module', 'path', 'stream',
  'url', 'util', 'zlib', 'net', 'tls', 'http', 'https',
  'worker_threads', 'string_decoder', 'querystring',
]

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/worker.js',
  format: 'esm',
  target: 'es2022',
  platform: 'neutral',
  mainFields: ['module', 'main'],
  conditions: ['worker', 'browser', 'import', 'default'],
  // Provide a CJS require shim for bundled packages that use require() on
  // Node built-ins (e.g. stripe → qs → object-inspect → require("util")).
  // Workers with nodejs_compat support these modules, but esbuild's
  // CJS-to-ESM conversion emits __require() which Workers reject.
  banner: {
    js: `import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);`,
  },
  external: [
    ...nodeBuiltins,
    'expo-server-sdk', // dynamically imported, not available in Workers
  ],
  alias: {
    'undici': './src/shims/undici.ts',
  },
})
