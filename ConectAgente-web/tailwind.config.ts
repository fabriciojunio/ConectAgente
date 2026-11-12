import type { Config } from 'tailwindcss';

type Familia = 'primaria' | 'erro' | 'sucesso' | 'alerta' | 'atencao' | 'info' | 'rosa';

/**
 * Liga uma escala do Tailwind (50 a 900) a uma família semântica de
 * `globals.css`. Os tons claros viram fundo, os do meio viram borda e cor
 * forte, os escuros viram texto. Assim `bg-red-50 text-red-700` continua
 * legível no tema escuro, porque o valor de cada papel muda com o `.dark`.
 */
function familia(nome: Familia) {
  const tom = (papel: 'fundo' | 'borda' | 'forte' | 'texto') =>
    `rgb(var(--tom-${nome}-${papel}) / <alpha-value>)`;
  return {
    DEFAULT: tom('forte'),
    50: tom('fundo'),
    100: tom('fundo'),
    200: tom('borda'),
    300: tom('borda'),
    400: tom('forte'),
    500: tom('forte'),
    600: tom('forte'),
    700: tom('texto'),
    800: tom('texto'),
    900: tom('texto'),
  };
}

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
        primary: familia('primaria'),
        purple: familia('primaria'),
        red: familia('erro'),
        danger: familia('erro'),
        green: familia('sucesso'),
        emerald: familia('sucesso'),
        success: familia('sucesso'),
        orange: familia('alerta'),
        warning: familia('alerta'),
        yellow: familia('atencao'),
        amber: familia('atencao'),
        blue: familia('info'),
        sky: familia('info'),
        info: familia('info'),
        pink: familia('rosa'),
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(22, 18, 29, 0.06)',
        'card-hover': '0 4px 12px rgba(22, 18, 29, 0.08)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};

export default config;
