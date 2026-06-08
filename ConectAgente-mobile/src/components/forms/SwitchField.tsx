import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { Control, Controller, FieldValues, Path } from 'react-hook-form';
import { FONT_SIZE, SPACING } from '../../utils/constants';
import { useTheme } from '../../contexts/ThemeContext';

interface SwitchFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  description?: string;
}

export function SwitchField<T extends FieldValues>({
  control, name, label, description,
}: SwitchFieldProps<T>) {
  const { colors } = useTheme();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value } }) => (
        <View style={[styles.container, { borderBottomColor: colors.borderLight }]}>
          <View style={styles.textContainer}>
            <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
            {description && <Text style={[styles.description, { color: colors.textLight }]}>{description}</Text>}
          </View>
          <Switch
            value={Boolean(value)}
            onValueChange={onChange}
            trackColor={{ false: colors.disabled, true: colors.primaryLight }}
            thumbColor={value ? colors.primary : colors.white}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  textContainer: {
    flex: 1,
    marginRight: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
  },
  description: {
    fontSize: FONT_SIZE.sm,
    marginTop: 2,
  },
});
