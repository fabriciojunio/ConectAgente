import React, { useState } from 'react';
import { TextInput, TextInputProps, View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, FONT_SIZE } from '../../utils/constants';

interface InputProps extends TextInputProps {
  secureToggle?: boolean;
}

export function Input({ secureToggle, secureTextEntry, style, ...rest }: InputProps) {
  const [showPassword, setShowPassword] = useState(false);

  if (secureToggle) {
    return (
      <View style={[styles.wrapper, style as object]}>
        <TextInput
          style={styles.inputInner}
          secureTextEntry={!showPassword}
          placeholderTextColor={COLORS.placeholder}
          {...rest}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eye}>
          <Ionicons
            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={COLORS.textLight}
          />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TextInput
      style={[styles.input, style]}
      secureTextEntry={secureTextEntry}
      placeholderTextColor={COLORS.placeholder}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    width: '100%',
    height: 52,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  wrapper: {
    width: '100%',
    height: 52,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.sm,
  },
  inputInner: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  eye: {
    padding: 4,
  },
});
