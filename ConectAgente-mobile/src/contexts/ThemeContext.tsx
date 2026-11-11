import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

const LIGHT = {
  primary: '#1565C0', primaryDark: '#0D47A1', primaryLight: '#42A5F5',
  primaryGradient: ['#0D47A1', '#1565C0', '#1976D2'] as const,
  secondary: '#00766A', secondaryLight: '#E0F2F1',
  background: '#F4F6FA', surface: '#FFFFFF', surfaceAlt: '#EEF2FB',
  // Texto e ícone sobre fundo colorido. Ver o comentário em DARK.
  onSolid: '#FFFFFF', onGradient: '#FFFFFF', switchThumb: '#FFFFFF',
  text: '#0F1621', textMedium: '#374151', textLight: '#5F6876', placeholder: '#6B7280',
  border: '#D1D9E6', borderLight: '#E5EAF2',
  error: '#C62828', errorLight: '#FFEBEE',
  success: '#2E7D32', successLight: '#E8F5E9',
  warning: '#B9470B', warningLight: '#FFF3E0',
  info: '#01669E', infoLight: '#E1F5FE',
  card: '#FFFFFF', cardShadow: 'rgba(21,101,192,0.08)',
  disabled: '#CBD5E1', overlay: 'rgba(13,71,161,0.45)', divider: '#E8EDF5',
  hipertenso: '#C62828', diabetico: '#6A1B9A', gestante: '#AD1457',
  puericultura: '#00695C', domiciliado: '#1565C0',
  // Fundos das etiquetas clinicas. Estavam escritos a mao dentro do Badge, e
  // por isso continuavam pastel no tema escuro, com texto claro em cima.
  hipertensoLight: '#FEF2F2', diabeticoLight: '#F5F3FF',
  gestanteLight: '#FDF2F8', puericulturaLight: '#F0FDF4',
  inputBg: '#FFFFFF', tabBar: '#FFFFFF',
  // Roxo do painel administrativo, que tem identidade propria de proposito,
  // e o par da caixa de aviso das telas de visita.
  accent: '#7B1FA2', accentLight: '#F3E5F5',
  aviso: '#1D4ED8', avisoFundo: '#EFF6FF', avisoBorda: '#BFDBFE',
};

const DARK = {
  primary: '#4FC3F7', primaryDark: '#0288D1', primaryLight: '#81D4FA',
  primaryGradient: ['#0D47A1', '#1565C0', '#1976D2'] as const,
  secondary: '#4DB6AC', secondaryLight: '#1A2E2C',
  background: '#0F1117', surface: '#1A1F2E', surfaceAlt: '#222840',
  // Antes havia `white: '#1A1F2E'`: o nome dizia branco e o valor era o fundo
  // escuro. Todo texto "branco" sobre o gradiente azul ficava azul-marinho
  // sobre azul (contraste 1,9:1) e sumia. Agora o nome diz o papel: sobre a
  // cor sólida, que no escuro é clara, o texto é escuro; sobre o gradiente,
  // que é escuro nos dois temas, é branco.
  onSolid: '#0F1117', onGradient: '#FFFFFF', switchThumb: '#B8C2D8',
  text: '#E8ECF4', textMedium: '#B8C2D8', textLight: '#8896B0', placeholder: '#8391AB',
  border: '#2A3348', borderLight: '#232B3E',
  error: '#F47C79', errorLight: 'rgba(239,83,80,0.15)',
  success: '#66BB6A', successLight: 'rgba(102,187,106,0.15)',
  warning: '#FFA726', warningLight: 'rgba(255,167,38,0.15)',
  info: '#29B6F6', infoLight: 'rgba(41,182,246,0.15)',
  card: '#1A1F2E', cardShadow: 'rgba(0,0,0,0.4)',
  disabled: '#374151', overlay: 'rgba(0,0,0,0.6)', divider: '#2A3348',
  hipertenso: '#EF9A9A', diabetico: '#CE93D8', gestante: '#F48FB1',
  puericultura: '#80CBC4', domiciliado: '#4FC3F7',
  // Translucidos, como os outros fundos do tema escuro, para a etiqueta
  // aparecer sem clarear o cartao inteiro.
  hipertensoLight: 'rgba(239,154,154,0.15)', diabeticoLight: 'rgba(206,147,216,0.15)',
  gestanteLight: 'rgba(244,143,177,0.15)', puericulturaLight: 'rgba(128,203,196,0.15)',
  inputBg: '#222840', tabBar: '#1A1F2E',
  accent: '#CE93D8', accentLight: 'rgba(206,147,216,0.15)',
  aviso: '#90CAF9', avisoFundo: 'rgba(144,202,249,0.12)', avisoBorda: 'rgba(144,202,249,0.3)',
};

/**
 * Paleta do tema.
 *
 * `primaryGradient` precisa ser alargado de proposito. Com `as const`, o tipo
 * de LIGHT fixa os tres valores exatos do tema claro, e aí a paleta escura
 * deixa de ser atribuivel: o compilador reclama que '#1565C0' nao e
 * '#1976D2'. Trocar para `string[]` resolveria o erro mas perderia a
 * aridade, que o LinearGradient exige (ele pede ao menos duas cores). Manter
 * a tupla de tres com `string` dentro atende os dois lados.
 */
export type ThemeColors = Omit<typeof LIGHT, 'primaryGradient'> & {
  primaryGradient: readonly [string, string, string];
};

/** As duas paletas, para o teste de contraste conferir cada par texto e fundo. */
export const PALETAS: Record<'claro' | 'escuro', ThemeColors> = { claro: LIGHT, escuro: DARK };

interface ThemeContextData {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextData>({
  mode: 'system', isDark: false, colors: LIGHT,
  setMode: () => {},
});

const THEME_KEY = 'app_theme_mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
    });
  }, []);

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';
  const colors = isDark ? DARK : LIGHT;

  function setMode(newMode: ThemeMode) {
    setModeState(newMode);
    AsyncStorage.setItem(THEME_KEY, newMode);
  }

  return (
    <ThemeContext.Provider value={{ mode, isDark, colors, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextData {
  return useContext(ThemeContext);
}
