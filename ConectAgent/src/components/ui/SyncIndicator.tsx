import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSync } from '../../contexts/SyncContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { COLORS, FONT_SIZE, SPACING } from '../../utils/constants';

export function SyncIndicator() {
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
        <Ionicons name="sync" size={14} color={COLORS.white} />
      ) : !isOnline ? (
        <Ionicons name="cloud-offline" size={14} color={COLORS.white} />
      ) : (
        <Ionicons name="cloud-upload" size={14} color={COLORS.white} />
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  offline: {
    backgroundColor: COLORS.error,
  },
  text: {
    color: COLORS.white,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
});
