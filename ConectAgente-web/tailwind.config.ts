import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#0d9488',
          600: '#0f766e',
          700: '#115e59',
          800: '#134e4a',
          900: '#042f2e',
        },
        success: { 50: '#E8F5E9', 500: '#4CAF50', 700: '#388E3C' },
        warning: { 50: '#FFF3E0', 500: '#f59e0b', 700: '#d97706' },
        danger:  { 50: '#FFEBEE', 500: '#ef4444', 700: '#b91c1c' },
        info:    { 50: '#eff6ff', 500: '#3b82f6', 700: '#1d4ed8' },
        gray: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#EEEEEE',
          300: '#E0E0E0',
          400: '#BDBDBD',
          500: '#9E9E9E',
          600: '#757575',
          700: '#616161',
          800: '#424242',
          900: '#212121',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(13, 148, 136, 0.08), 0 1px 2px rgba(13, 148, 136, 0.06)',
        'card-hover': '0 4px 6px rgba(13, 148, 136, 0.12), 0 2px 4px rgba(13, 148, 136, 0.06)',
        sidebar: '2px 0 12px rgba(13, 148, 136, 0.1)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};

export default config;
