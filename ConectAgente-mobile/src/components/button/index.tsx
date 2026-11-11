import React, { useMemo } from 'react';
import { TouchableOpacity, TouchableOpacityProps, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FONT_SIZE, RADIUS, SPACING } from '../../utils/constants';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({ title, variant = 'primary', loading, icon, disabled, ...rest }: ButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => criarStyles(colors), [colors]);
  const isDisabled = disabled || loading;

  if (variant === 'primary') {
    return (
      <TouchableOpacity style={styles.buttonContainer} disabled={isDisabled} {...rest}>
        <LinearGradient
          colors={isDisabled ? [colors.disabled, colors.disabled] : colors.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {loading ? (
            <ActivityIndicator color={colors.onGradient} size="small" />
          ) : (
            <>
              {icon}
              <Text style={styles.primaryText}>{title}</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  const variantStyle = {
    secondary: styles.secondary,
    danger: styles.danger,
    ghost: styles.ghost,
  }[variant];

  const textStyle = {
    secondary: styles.secondaryText,
    danger: styles.dangerText,
    ghost: styles.ghostText,
  }[variant];

  return (
    <TouchableOpacity
      style={[styles.button, variantStyle, isDisabled && styles.buttonDisabled]}
      disabled={isDisabled}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'ghost' ? colors.primary : colors.onSolid}
          size="small"
        />
      ) : (
        <>
          {icon}
          <Text style={textStyle}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const criarStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  buttonContainer: {
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  gradient: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  primaryText: {
    color: colors.onGradient,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  button: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.full,
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  secondary: {
    backgroundColor: colors.secondary,
  },
  danger: {
    backgroundColor: colors.error,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  secondaryText: {
    color: colors.onSolid,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  dangerText: {
    color: colors.onSolid,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  ghostText: {
    color: colors.primary,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
});
