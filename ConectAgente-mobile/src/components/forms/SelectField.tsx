import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList, StyleSheet,
} from 'react-native';
import { Control, Controller, FieldValues, Path } from 'react-hook-form';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZE, SPACING, RADIUS } from '../../utils/constants';
import { useTheme } from '../../contexts/ThemeContext';

interface Option {
  label: string;
  value: string;
}

interface SelectFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  options: Option[];
  placeholder?: string;
  required?: boolean;
}

export function SelectField<T extends FieldValues>({
  control, name, label, options, placeholder = 'Selecione...', required,
}: SelectFieldProps<T>) {
  const [modalVisible, setModalVisible] = useState(false);
  const { colors } = useTheme();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value }, fieldState: { error } }) => {
        const selected = options.find((o) => o.value === value);
        return (
          <View style={styles.container}>
            <Text style={[styles.label, { color: colors.text }]}>
              {label}{required && <Text style={{ color: colors.error }}> *</Text>}
            </Text>
            <TouchableOpacity
              style={[
                styles.selector,
                { borderColor: colors.borderLight, backgroundColor: colors.inputBg },
                error && { borderColor: colors.error },
              ]}
              onPress={() => setModalVisible(true)}
            >
              <Text style={[styles.selectorText, { color: selected ? colors.text : colors.placeholder }]}>
                {selected?.label ?? placeholder}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textLight} />
            </TouchableOpacity>
            {error && <Text style={[styles.errorText, { color: colors.error }]}>{error.message}</Text>}

            <Modal visible={modalVisible} transparent animationType="slide">
              <TouchableOpacity
                style={[styles.overlay, { backgroundColor: colors.overlay }]}
                onPress={() => setModalVisible(false)}
              />
              <View style={[styles.modal, { backgroundColor: colors.surface }]}>
                <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>{label}</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={options}
                  keyExtractor={(item) => item.value}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.option,
                        { borderBottomColor: colors.borderLight },
                        item.value === value && { backgroundColor: colors.infoLight },
                      ]}
                      onPress={() => {
                        onChange(item.value);
                        setModalVisible(false);
                      }}
                    >
                      <Text style={[
                        styles.optionText,
                        { color: colors.text },
                        item.value === value && { color: colors.primary, fontWeight: '600' },
                      ]}>
                        {item.label}
                      </Text>
                      {item.value === value && (
                        <Ionicons name="checkmark" size={18} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  )}
                />
              </View>
            </Modal>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  label: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  selector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm + 4,
  },
  selectorText: { fontSize: FONT_SIZE.md },
  errorText: { fontSize: FONT_SIZE.xs },
  overlay: { flex: 1 },
  modal: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl, maxHeight: '60%',
    paddingBottom: SPACING.xl,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: SPACING.md, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700' },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 4,
    borderBottomWidth: 1,
  },
  optionText: { fontSize: FONT_SIZE.md },
});
