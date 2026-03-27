import React from 'react';
import { View, ViewStyle, StyleSheet, Platform } from 'react-native';
import { SPACING, RADIUS } from '../../utils/constants';
import { useTheme } from '../../contexts/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined' | 'flat';
  padding?: keyof typeof SPACING | number;
}

export function Card({ children, style, variant = 'default', padding }: CardProps) {
  const { colors } = useTheme();

  const paddingValue = padding !== undefined
    ? (typeof padding === 'number' ? padding : SPACING[padding])
    : SPACING.md;

  const variantStyle = variant === 'flat'
    ? { backgroundColor: colors.surfaceAlt }
    : variant === 'outlined'
    ? { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderLight }
    : { backgroundColor: colors.card };

  const shadowStyle = variant === 'default'
    ? Platform.select({
        ios: {
          shadowColor: colors.cardShadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 1,
          shadowRadius: 8,
        },
        android: { elevation: 2 },
      })
    : variant === 'elevated'
    ? Platform.select({
        ios: {
          shadowColor: colors.cardShadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 1,
          shadowRadius: 12,
        },
        android: { elevation: 5 },
      })
    : Platform.select({
        ios: { shadowOpacity: 0 },
        android: { elevation: 0 },
      });

  return (
    <View
      style={[
        styles.base,
        variantStyle,
        shadowStyle,
        { padding: paddingValue },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.lg,
  },
});
