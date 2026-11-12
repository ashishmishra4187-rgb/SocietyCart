/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#effaf8', 100: '#d5f2ee', 200: '#aae5dd', 300: '#74d0c6', 400: '#3db3a8',
          500: '#0F766E', 600: '#0D5F58', 700: '#0b4d48', 800: '#093d39', 900: '#082f2c',
        },
        // Darkened from the mock's #16A34A so small savings text meets WCAG AA (>= 4.5:1 on white).
        savings: '#15803D',
      },
      boxShadow: { xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)' },
      backdropBlur: { xs: '2px' },
      spacing: { 13: '3.25rem' },
      keyframes: {
        fadeIn: { from: { opacity: '0', transform: 'translateY(-2px)' }, to: { opacity: '1', transform: 'none' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: { fadeIn: 'fadeIn 150ms ease-out', scaleIn: 'scaleIn 150ms ease-out' },
    },
  },
  plugins: [],
};
