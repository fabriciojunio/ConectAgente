import React, { useMemo, useState } from 'react';
import { TextInput, TextInputProps, View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SPACING, FONT_SIZE } from '../../utils/constants';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';

interface InputProps extends TextInputProps {
  secureToggle?: boolean;
}

export function Input({ secureToggle, secureTextEntry, style, ...rest }: InputProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => criarStyles(colors), [colors]);
  const [showPassword, setShowPassword] = useState(false);

  if (secureToggle) {
    return (
      <View style={[styles.wrapper, style as object]}>
        <TextInput
          style={styles.inputInner}
          secureTextEntry={!showPassword}
          placeholderTextColor={colors.placeholder}
          {...rest}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eye}>
          <Ionicons
            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={colors.textLight}
          />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TextInput
      style={[styles.input, style]}
      secureTextEntry={secureTextEntry}
      placeholderTextColor={colors.placeholder}
      {...rest}
    />
  );
}

const criarStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  input: {
    width: '100%',
    height: 52,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: colors.text,
    backgroundColor: colors.inputBg,
  },
  wrapper: {
    width: '100%',
    height: 52,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    paddingHorizontal: SPACING.sm,
  },
  inputInner: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: colors.text,
  },
  eye: {
    padding: 4,
  },
});
