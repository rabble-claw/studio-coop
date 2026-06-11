/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Keep in sync with apps/web/src/styles/globals.css @theme tokens
        background: '#faf6f0',
        foreground: '#211a16',
        primary: '#d94f35',
        secondary: '#f4e9dd',
        muted: '#6e6259',
        border: '#e6dacb',
        card: '#fffdfa',
        accent: '#f3c64f',
        pine: '#25655a',
      },
    },
  },
  plugins: [],
}
