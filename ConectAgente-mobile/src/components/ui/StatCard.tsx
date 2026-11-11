import React, { useMemo } from 'react';
import { Text, TouchableOpacity, StyleSheet, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZE, RADIUS, SPACING } from '../../utils/constants';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  /** Cor do ícone, do número e da faixa de cima. */
  accent: string;
  onPress?: () => void;
  /** Largura no grid de quem usa: o Início divide a linha, o painel usa 30%. */
  style?: StyleProp<ViewStyle>;
}

/** Número de destaque com ícone e rótulo, tocável quando leva a uma lista. */
export function StatCard({ icon, label, value, accent, onPress, style }: StatCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => criarEstilos(colors), [colors]);

  return (
    <TouchableOpacity
      style={[styles.card, { borderTopColor: accent }, style]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={20} color={accent} />
      <Text style={[styles.value, { color: accent }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const criarEstilos = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      paddingVertical: SPACING.sm + 4,
      paddingHorizontal: SPACING.xs,
      gap: 2,
      borderTopWidth: 3,
      ...Platform.select({
        ios: {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
        },
        android: { elevation: 2 },
      }),
    },
    value: { fontSize: FONT_SIZE.xxl, fontWeight: '800', marginTop: 2 },
    label: { fontSize: 11, color: colors.textLight, fontWeight: '500', textAlign: 'center' },
  });
