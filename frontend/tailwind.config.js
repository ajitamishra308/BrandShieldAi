/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#101B2D',
        canvas: '#F5F7FB',
        brand: { DEFAULT: '#18B7A0', dark: '#0F9380', soft: '#E6F7F4' },
        danger: { DEFAULT: '#C24141', soft: '#FFF0F0' },
        warn: { DEFAULT: '#B7791F', soft: '#FFF6E0' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
