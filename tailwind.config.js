/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#00BC7D',      // Cash Green
          light: '#3B82F6',        // Blue Ocean
          dark: '#009B66',         // Darker Cash Green
          bg: '#e6f9f1',          // Light green background
          text: '#009B66',
        },
        // Brand colors
        'cash-green': {
          DEFAULT: '#00BC7D',
          50: '#e6f9f1',
          100: '#b3ecd6',
          200: '#80dfbb',
          300: '#4dd2a0',
          400: '#26c88c',
          500: '#00BC7D',
          600: '#009B66',
          700: '#007A50',
          800: '#005A3B',
          900: '#003A26',
        },
        'blue-ocean': {
          DEFAULT: '#3B82F6',
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3B82F6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        'base-black': '#111625',
        // Accent colors for UI components
        accent: {
          primary: '#00BC7D',      // Cash Green (primary actions)
          hover: '#009B66',        // Darker green on hover
          light: '#b3ecd6',        // Light green for subtle backgrounds
          warm: '#f59e0b',         // Amber/orange for secondary actions
          'warm-hover': '#d97706', // Darker amber on hover
          orange: '#f59e0b',       // Orange for required indicators
        },
        // Surface colors for backgrounds
        surface: {
          bg: '#ffffff',           // White background
          dark: '#111625',         // Base Black background
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        light: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
        medium: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        base: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        md: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        lg: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        xl: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      },
      spacing: {
        'safe': 'env(safe-area-inset-bottom)',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      keyframes: {
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
      },
      zIndex: {
        '0': '0',
        '10': '10',
        '20': '20',
        '30': '30',
        '40': '40',
        '50': '50',
        'header': '60',
        'warning': '70',
        'overlay': '100',
        'modal': '1000',
        'popover': '1050',
        'tooltip': '1100',
        'chatbot': '9998',
        'floating-button': '9999',
      },
    },
  },
  plugins: [],
}