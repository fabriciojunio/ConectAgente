import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

const LIGHT = {
  primary: '#1565C0', primaryDark: '#0D47A1', primaryLight: '#42A5F5',
  primaryGradient: ['#0D47A1', '#1976D2', '#42A5F5'] as const,
  secondary: '#00897B', secondaryLight: '#E0F2F1',
  background: '#F4F6FA', surface: '#FFFFFF', surfaceAlt: '#EEF2FB',
  white: '#FFFFFF', black: '#000000',
  text: '#0F1621', textMedium: '#374151', textLight: '#6B7280', placeholder: '#9CA3AF',
  border: '#D1D9E6', borderLight: '#E5EAF2',
  error: '#D32F2F', errorLight: '#FFEBEE',
  success: '#2E7D32', successLight: '#E8F5E9',
  warning: '#E65100', warningLight: '#FFF3E0',
  info: '#0277BD', infoLight: '#E1F5FE',
  card: '#FFFFFF', cardShadow: 'rgba(21,101,192,0.08)',
  disabled: '#CBD5E1', overlay: 'rgba(13,71,161,0.45)', divider: '#E8EDF5',
  hipertenso: '#C62828', diabetico: '#6A1B9A', gestante: '#AD1457',
  puericultura: '#00695C', domiciliado: '#1565C0',
  inputBg: '#FFFFFF', tabBar: '#FFFFFF',
};

const DARK = {
  primary: '#4FC3F7', primaryDark: '#0288D1', primaryLight: '#81D4FA',
  primaryGradient: ['#0D47A1', '#1565C0', '#1976D2'] as const,
  secondary: '#4DB6AC', secondaryLight: '#1A2E2C',
  background: '#0F1117', surface: '#1A1F2E', surfaceAlt: '#222840',
  white: '#1A1F2E', black: '#FFFFFF',
  text: '#E8ECF4', textMedium: '#B8C2D8', textLight: '#8896B0', placeholder: '#5A6880',
  border: '#2A3348', borderLight: '#232B3E',
  error: '#EF5350', errorLight: 'rgba(239,83,80,0.15)',
  success: '#66BB6A', successLight: 'rgba(102,187,106,0.15)',
  warning: '#FFA726', warningLight: 'rgba(255,167,38,0.15)',
  info: '#29B6F6', infoLight: 'rgba(41,182,246,0.15)',
  card: '#1A1F2E', cardShadow: 'rgba(0,0,0,0.4)',
  disabled: '#374151', overlay: 'rgba(0,0,0,0.6)', divider: '#2A3348',
  hipertenso: '#EF9A9A', diabetico: '#CE93D8', gestante: '#F48FB1',
  puericultura: '#80CBC4', domiciliado: '#4FC3F7',
  inputBg: '#222840', tabBar: '#1A1F2E',
};

export type ThemeColors = typeof LIGHT;

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
