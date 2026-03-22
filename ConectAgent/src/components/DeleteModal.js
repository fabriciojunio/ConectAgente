import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';

export default function DeleteModal({ visible, onConfirm, onCancel, userName }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.dotsContainer}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
          
          <Ionicons name="warning-outline" size={40} color={theme.colors.text} style={styles.icon} />
          
          <Text style={styles.message}>
            Deseja remover permanentemente esse usuário?
          </Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={[styles.button, styles.btnNo]} onPress={onCancel}>
              <Text style={styles.btnText}>Não</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.button, styles.btnYes]} onPress={onConfirm}>
              <Text style={styles.btnText}>Sim</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 14, 69, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '85%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.error,
  },
  dotsContainer: {
    flexDirection: 'row',
    position: 'absolute',
    top: 15,
    left: 15,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.error,
    marginRight: 4,
  },
  icon: {
    marginBottom: theme.spacing.md,
  },
  message: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: 20,
    alignItems: 'center',
    marginHorizontal: theme.spacing.xs,
  },
  btnNo: {
    backgroundColor: theme.colors.error,
  },
  btnYes: {
    backgroundColor: theme.colors.success,
  },
  btnText: {
    color: theme.colors.text, // Wait, the UI has black text over red and green. I'll use bold text.
    fontWeight: theme.typography.weights.bold,
  }
});
