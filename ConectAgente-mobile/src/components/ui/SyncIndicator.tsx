import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSync } from '../../contexts/SyncContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { FONT_SIZE, SPACING } from '../../utils/constants';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';
import { explicarFalhaDeSincronizacao } from '../../utils/falhaDeSincronizacao';

export function SyncIndicator() {
  const { colors } = useTheme();
  const styles = useMemo(() => criarStyles(colors), [colors]);
  const { status, sincronizarAgora } = useSync();
  const { isOnline } = useNetwork();

  const parada = isOnline && !!status.erro && status.pendentes > 0;

  if (!status.pendentes && isOnline) return null;

  async function sincronizarEContar() {
    const r = await sincronizarAgora({ reabrirErros: true });
    if (r.ok && r.pendentes === 0) {
      Alert.alert('Tudo enviado', 'Os registros deste celular chegaram ao servidor.');
    } else if (r.ok) {
      Alert.alert(
        'Parte ficou pendente',
        `${r.pendentes} registro(s) ainda não foram aceitos pelo servidor. O aplicativo tenta de novo sozinho.`
      );
    } else {
      Alert.alert('Sincronização parada', explicarFalhaDeSincronizacao(r.erro));
    }
  }

  function handlePress() {
    if (parada) {
      Alert.alert('Sincronização parada', explicarFalhaDeSincronizacao(status.erro), [
        { text: 'Fechar', style: 'cancel' },
        { text: 'Tentar de novo', onPress: () => void sincronizarEContar() },
      ]);
      return;
    }
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
        { text: 'Sincronizar', onPress: () => void sincronizarEContar() },
      ]
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, !isOnline && styles.offline, parada && styles.parada]}
      onPress={handlePress}
      accessibilityLabel={parada ? 'Sincronização parada, toque para ver o motivo' : undefined}
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
          : parada
          ? `Parada • ${status.pendentes}`
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
  parada: {
    backgroundColor: colors.error,
  },
  text: {
    color: colors.onSolid,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
});
