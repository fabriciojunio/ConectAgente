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
          50: '#E3F2FD',
          100: '#BBDEFB',
          200: '#90CAF9',
          300: '#64B5F6',
          400: '#42A5F5',
          500: '#1565C0',
          600: '#1256A8',
          700: '#0D47A1',
          800: '#0A3880',
          900: '#072960',
        },
        success: { 50: '#E8F5E9', 500: '#4CAF50', 700: '#388E3C' },
        warning: { 50: '#FFF3E0', 500: '#FF9800', 700: '#F57C00' },
        danger: { 50: '#FFEBEE', 500: '#F44336', 700: '#D32F2F' },
        info: { 50: '#E3F2FD', 500: '#2196F3', 700: '#1976D2' },
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
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(21, 101, 192, 0.08), 0 1px 2px rgba(21, 101, 192, 0.06)',
        'card-hover': '0 4px 6px rgba(21, 101, 192, 0.1), 0 2px 4px rgba(21, 101, 192, 0.06)',
        sidebar: '2px 0 12px rgba(21, 101, 192, 0.08)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};

export default config;
