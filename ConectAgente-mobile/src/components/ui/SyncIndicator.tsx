import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSync } from '../../contexts/SyncContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { FONT_SIZE, SPACING } from '../../utils/constants';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';

export function SyncIndicator() {
  const { colors } = useTheme();
  const styles = useMemo(() => criarStyles(colors), [colors]);
  const { status, sincronizarAgora } = useSync();
  const { isOnline } = useNetwork();

  if (!status.pendentes && isOnline) return null;

  function handlePress() {
    if (!isOnline) {
      Alert.alert(
        'Sem conexão',
        `Você está offline.\n${status.pendentes} registro(s) aguardam sincronização.\n\nOs dados serão sincronizados automaticamente quando a conexão for restaurada.`
      );
      return;
    }
    Alert.alert(
      'Sincronização pendente',
      `${status.pendentes} registro(s) aguardam sincronização com o servidor.\n\nDeseja sincronizar agora?`,
      [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Sincronizar', onPress: sincronizarAgora },
      ]
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, !isOnline && styles.offline]}
      onPress={handlePress}
    >
      {status.sincronizando ? (
        <Ionicons name="sync" size={14} color={colors.onSolid} />
      ) : !isOnline ? (
        <Ionicons name="cloud-offline" size={14} color={colors.onSolid} />
      ) : (
        <Ionicons name="cloud-upload" size={14} color={colors.onSolid} />
      )}
      <Text style={styles.text}>
        {status.sincronizando
          ? 'Sincronizando...'
          : !isOnline
          ? `Offline • ${status.pendentes} pendentes`
          : `${status.pendentes} pendentes`}
      </Text>
    </TouchableOpacity>
  );
}

const criarStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  offline: {
    backgroundColor: colors.error,
  },
  text: {
    color: colors.onSolid,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
});
