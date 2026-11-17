/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/renderer/**/*.{js,jsx,ts,tsx}', './src/renderer/index.ejs'],
  theme: {
    extend: {
      colors: {
        // Xenolink ink scale — primary action/chrome colour
        primary: {
          50: '#fff4ee',
          100: '#ffe6d8',
          200: '#ffcbb0',
          300: '#ffa77f',
          400: '#ff814d',
          500: '#e9783f', // action orange
          600: '#d96a36',
          700: '#c25b2e',
          800: '#a53e0c',
          900: '#86340d',
          950: '#4a1a05',
        },
        // Xenolink orange accent
        accent: {
          50: '#fff4ef',
          100: '#ffe6da',
          200: '#ffcab3',
          300: '#ffa681',
          400: '#ff7f4f',
          500: '#ff5a1f', // Xenolink orange
          600: '#e14e16',
          700: '#c13f0f',
          800: '#99320c',
          900: '#7a2a0b',
        },
        brand: {
          ink: '#11151c',
          paper: '#f4f2ee',
          'paper-deep': '#eceae4',
          accent: '#e9783f',
          'accent-deep': '#d96a36',
          muted: '#6b7280',
        },
        // Semantic status tokens — use instead of raw emerald/red/amber/blue
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        info: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        // Surface tokens for consistent background usage
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f9fafb', // gray-50
          subtle: '#f3f4f6', // gray-100
          raised: '#ffffff',
        },
      },
      fontFamily: {
        sans: [
          'InterVariable',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        display: [
          'PlusJakarta',
          'InterVariable',
          'Inter',
          '-apple-system',
          'sans-serif',
        ],
      },
      borderRadius: {
        // Enterprise radius scale
        card: '0.75rem', // 12px — all cards
        modal: '1rem', // 16px — modals, slide-overs
        button: '0.5rem', // 8px  — buttons, inputs
      },
      keyframes: {
        progress: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-in-scale': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        progress: 'progress 1s linear infinite',
        'fade-in-scale': 'fade-in-scale 0.2s ease-out',
        'slide-up': 'slide-up 0.15s ease-out',
      },
    },
  },
  plugins: [],
};
