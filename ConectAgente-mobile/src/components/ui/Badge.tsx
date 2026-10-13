import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FONT_SIZE, SPACING, RADIUS } from '../../utils/constants';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';

type BadgeVariant = 'hipertenso' | 'diabetico' | 'gestante' | 'puericultura' | 'success' | 'warning' | 'error' | 'info' | 'medio';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

// Os fundos das quatro condicoes clinicas e o do `medio` estavam escritos a
// mao em pastel. No tema escuro a etiqueta continuava clara, com texto claro
// em cima, e nao dava para ler. Agora saem da paleta, que tem a versao
// translucida para o tema escuro.
const criarVariantColors = (
  colors: ThemeColors
): Record<BadgeVariant, { bg: string; text: string }> => ({
  hipertenso: { bg: colors.hipertensoLight, text: colors.hipertenso },
  diabetico: { bg: colors.diabeticoLight, text: colors.diabetico },
  gestante: { bg: colors.gestanteLight, text: colors.gestante },
  puericultura: { bg: colors.puericulturaLight, text: colors.puericultura },
  success: { bg: colors.successLight, text: colors.success },
  warning: { bg: colors.warningLight, text: colors.warning },
  error: { bg: colors.errorLight, text: colors.error },
  info: { bg: colors.infoLight, text: colors.info },
  medio: { bg: colors.warningLight, text: colors.warning },
});

export function Badge({ label, variant = 'info' }: BadgeProps) {
  const { colors } = useTheme();
  const variantes = useMemo(() => criarVariantColors(colors), [colors]);
  const cor = variantes[variant];
  return (
    <View style={[styles.badge, { backgroundColor: cor.bg }]}>
      <Text style={[styles.text, { color: cor.text }]}>{label}</Text>
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
