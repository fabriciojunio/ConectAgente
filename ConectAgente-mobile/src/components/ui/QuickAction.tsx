import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZE, RADIUS, SPACING } from '../../utils/constants';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';

interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  /** Tamanho do quadrado do ícone. */
  iconBoxSize?: number;
  /** Largura no grid de quem usa (o Início usa 31% para três por linha). */
  style?: StyleProp<ViewStyle>;
}

/** Atalho com ícone num quadrado colorido e rótulo embaixo. */
export function QuickAction({ icon, label, color, onPress, iconBoxSize = 60, style }: QuickActionProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => criarEstilos(colors), [colors]);

  return (
    <TouchableOpacity style={[styles.btn, style]} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.iconBox, { width: iconBoxSize, height: iconBoxSize, backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={26} color={color} />
      </View>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

const criarEstilos = (colors: ThemeColors) =>
  StyleSheet.create({
    btn: { alignItems: 'center', gap: SPACING.xs },
    iconBox: { borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center' },
    label: { fontSize: FONT_SIZE.xs, color: colors.text, fontWeight: '600', textAlign: 'center' },
  });
