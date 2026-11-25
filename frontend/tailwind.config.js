/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#effaf8', 100: '#d5f2ee', 200: '#aae5dd', 300: '#74d0c6', 400: '#3db3a8',
          500: '#176044', 600: '#104C35', 700: '#0b4d48', 800: '#093d39', 900: '#082f2c',
        },
        // Darkened from the mock's #16A34A so small savings text meets WCAG AA (>= 4.5:1 on white).
        savings: '#15803D',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        glow: '0 0 20px -3px rgba(15, 118, 110, 0.35)',
      },
      backdropBlur: { xs: '2px' },
      spacing: { 13: '3.25rem' },
      keyframes: {
        fadeIn: { from: { opacity: '0', transform: 'translateY(-2px)' }, to: { opacity: '1', transform: 'none' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'none' } },
        pop: {
          '0%': { opacity: '0', transform: 'scale(0.6) translateY(-12px)' },
          '60%': { opacity: '1', transform: 'scale(1.08)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        confetti: {
          '0%': { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
          '100%': { opacity: '0', transform: 'translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(220deg) scale(0.6)' },
        },
        pulseGlow: {
          '0%, 100%': { transform: 'scale(1)', filter: 'drop-shadow(0 0 0 rgba(21, 128, 61, 0))' },
          '50%': { transform: 'scale(1.05)', filter: 'drop-shadow(0 0 8px rgba(21, 128, 61, 0.4))' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 180ms ease-out',
        scaleIn: 'scaleIn 180ms ease-out',
        pop: 'pop 450ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        confetti: 'confetti 900ms ease-out forwards',
        pulseGlow: 'pulseGlow 2.5s infinite ease-in-out',
      },
    },
  },
  plugins: [],
};
