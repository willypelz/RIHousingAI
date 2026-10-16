/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        // "Ocean State" brand palette — deep teal-blue
        brand: {
          50: '#effbfa',
          100: '#d5f3f2',
          200: '#afe6e7',
          300: '#79d1d6',
          400: '#3eb3bd',
          500: '#2396a3',
          600: '#1e7a8a',
          700: '#1e6271',
          800: '#20515d',
          900: '#1f444f',
          950: '#0d2b35',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 3px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(15, 23, 42, 0.05)',
        lift: '0 4px 12px rgba(15, 23, 42, 0.08), 0 12px 32px rgba(15, 23, 42, 0.10)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        typing: {
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-4px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        'fade-in': 'fade-in 0.25s ease-out both',
        'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite',
        typing: 'typing 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
