import React from 'react';
import {
  View, Text, TextInput, TextInputProps, StyleSheet, TouchableOpacity,
} from 'react-native';
import { Control, Controller, FieldValues, Path } from 'react-hook-form';
import { FONT_SIZE, SPACING, RADIUS } from '../../utils/constants';
import { useTheme } from '../../contexts/ThemeContext';

interface FormFieldProps<T extends FieldValues> extends TextInputProps {
  control: Control<T>;
  name: Path<T>;
  label: string;
  mask?: (value: string) => string;
  rightElement?: React.ReactNode;
  required?: boolean;
}

export function FormField<T extends FieldValues>({
  control, name, label, mask, rightElement, required, ...inputProps
}: FormFieldProps<T>) {
  const { colors } = useTheme();
  const { onBlur: customOnBlur, ...restInputProps } = inputProps as TextInputProps & { onBlur?: () => void };

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <View style={styles.container}>
          <Text style={[styles.label, { color: colors.text }]}>
            {label}
            {required && <Text style={{ color: colors.error }}> *</Text>}
          </Text>
          <View style={[
            styles.inputWrapper,
            { borderColor: colors.borderLight, backgroundColor: colors.inputBg },
            error && { borderColor: colors.error },
          ]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={value ? String(value) : ''}
              onChangeText={(text) => onChange(mask ? mask(text) : text)}
              onBlur={() => { onBlur(); customOnBlur?.(); }}
              placeholderTextColor={colors.placeholder}
              {...restInputProps}
              autoCapitalize={
                restInputProps.keyboardType === 'numeric' ||
                restInputProps.keyboardType === 'phone-pad' ||
                restInputProps.keyboardType === 'email-address' ||
                restInputProps.secureTextEntry
                  ? 'none'
                  : restInputProps.multiline
                  ? 'sentences'
                  : 'words'
              }
            />
            {rightElement}
          </View>
          {error && <Text style={[styles.errorText, { color: colors.error }]}>{error.message}</Text>}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    paddingVertical: SPACING.sm,
  },
  errorText: {
    fontSize: FONT_SIZE.xs,
  },
});
