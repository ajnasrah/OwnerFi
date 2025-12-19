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
          DEFAULT: '#1e40af',
          light: '#3b82f6',
          dark: '#1e3a8a',
          bg: '#eff6ff',
          text: '#1e3a8a',
        },
        // Full blue scale matching CSS variables
        blue: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Accent colors for UI components
        accent: {
          primary: '#1e40af',      // Deep blue (primary actions)
          hover: '#1e3a8a',        // Darker blue on hover
          light: '#bfdbfe',        // Light blue for subtle backgrounds
          warm: '#f59e0b',         // Amber/orange for secondary actions
          'warm-hover': '#d97706', // Darker amber on hover
          orange: '#f59e0b',       // Orange for required indicators
        },
        // Surface colors for backgrounds
        surface: {
          bg: '#ffffff',           // White background
          dark: '#0f172a',         // Dark slate background
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