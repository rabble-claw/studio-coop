// Build static landing page for GitHub Pages at studio.coop
import { writeFileSync, mkdirSync, cpSync, existsSync } from 'fs'

// We'll do a Next.js static export
console.log('Building static export...')
