/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#faf8f5',
        foreground: '#1a1a1a',
        primary: '#e85d4a',
        secondary: '#f5ede6',
        muted: '#6b6560',
        border: '#e5ddd5',
        card: '#ffffff',
      },
    },
  },
  plugins: [],
}
