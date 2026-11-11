import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FONT_SIZE, SPACING } from '../../utils/constants';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';

interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
  /** Cor do link da ação. O painel administrativo usa o roxo dele. */
  actionColor?: string;
}

/** Título de seção com um link opcional à direita ("Ver todas"). */
export function SectionHeader({ title, action, actionColor }: SectionHeaderProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => criarEstilos(colors), [colors]);

  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={action.onPress} hitSlop={8}>
          <Text style={[styles.action, actionColor ? { color: actionColor } : null]}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const criarEstilos = (colors: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
    title: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: colors.text },
    action: { fontSize: FONT_SIZE.sm, color: colors.primary, fontWeight: '600' },
  });
