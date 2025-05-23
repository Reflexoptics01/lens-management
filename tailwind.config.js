/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        'sansa': ['Sansa', 'sans-serif'],
        'sans': ['Open Sans', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#4169E1',
          hover: '#3154b3',
          light: '#E6ECFC',
        },
        accent: {
          gold: '#FFD700',
          teal: '#20B2AA',
          coral: '#FF6B6B',
        },
        neutral: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
        dark: {
          bg: {
            primary: '#0F172A',
            secondary: '#1E293B',
            tertiary: '#334155',
          },
          text: {
            primary: '#F1F5F9',
            secondary: '#CBD5E1',
            muted: '#94A3B8',
          },
          border: {
            primary: '#334155',
            secondary: '#475569',
          }
        }
      },
      boxShadow: {
        'custom': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'custom-md': '0 4px 6px -1px rgba(65, 105, 225, 0.1), 0 2px 4px -1px rgba(65, 105, 225, 0.06)',
        'dark': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} 