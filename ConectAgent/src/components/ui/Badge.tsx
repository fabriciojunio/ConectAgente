import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING, RADIUS } from '../../utils/constants';

type BadgeVariant = 'hipertenso' | 'diabetico' | 'gestante' | 'puericultura' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const VARIANT_COLORS: Record<BadgeVariant, { bg: string; text: string }> = {
  hipertenso: { bg: '#fef2f2', text: COLORS.hipertenso },
  diabetico: { bg: '#f5f3ff', text: COLORS.diabetico },
  gestante: { bg: '#fdf2f8', text: COLORS.gestante },
  puericultura: { bg: '#f0fdf4', text: COLORS.puericultura },
  success: { bg: COLORS.successLight, text: COLORS.success },
  warning: { bg: COLORS.warningLight, text: COLORS.warning },
  error: { bg: COLORS.errorLight, text: COLORS.error },
  info: { bg: COLORS.infoLight, text: COLORS.info },
};

export function Badge({ label, variant = 'info' }: BadgeProps) {
  const colors = VARIANT_COLORS[variant];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
});
