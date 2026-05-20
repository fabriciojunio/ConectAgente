import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, RefreshControl, Alert, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useResidencias } from '../../hooks/useResidencias';
import { Residencia } from '../../types';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/ui/PageHeader';
import { moradorRepository } from '../../database/repositories/moradorRepository';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../utils/constants';

export default function Residencias() {
  const { residencias, isLoading, carregar, excluir } = useResidencias();
  const { agente } = useAuth();
  const [busca, setBusca] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [responsaveisMap, setResponsaveisMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (residencias.length === 0) return;
    moradorRepository.listarResponsaveis(agente?.id).then((lista) => {
      const map: Record<string, string> = {};
      lista.forEach((m) => { map[m.residencia_id] = m.nome; });
      setResponsaveisMap(map);
    }).catch(() => {});
  }, [residencias, agente?.id]);

  async function onRefresh() {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }

  function confirmarExclusao(residencia: Residencia) {
    Alert.alert(
      'Excluir residência',
      `Deseja realmente excluir o endereço "${residencia.logradouro}, ${residencia.numero}"?\n\nOs moradores vinculados também serão removidos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => excluir(residencia.id),
        },
      ]
    );
  }

  const filtradas = residencias.filter((r) => {
    const q = busca.toLowerCase();
    return (
      r.logradouro.toLowerCase().includes(q) ||
      r.bairro.toLowerCase().includes(q) ||
      r.cep.includes(q)
    );
  });

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader
        title="Residências"
        rightAction={{
          icon: 'add-circle-outline',
          onPress: () => router.push('/(app)/residencia/nova'),
        }}
      />

      {/* BUSCA */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color={COLORS.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por endereço ou bairro..."
          value={busca}
          onChangeText={setBusca}
          placeholderTextColor={COLORS.placeholder}
        />
        {busca.length > 0 && (
          <TouchableOpacity onPress={() => setBusca('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <LoadingSpinner message="Carregando residências..." />
      ) : (
        <FlatList
          data={filtradas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <EmptyState
              icon="home-outline"
              title="Nenhuma residência"
              description={busca ? 'Sem resultados para esta busca' : 'Cadastre a primeira residência tocando no + acima'}
            />
          }
          renderItem={({ item }) => (
            <ResidenciaCard
              residencia={item}
              responsavelNome={responsaveisMap[item.id]}
              onPress={() => router.push({ pathname: '/(app)/residencia/[id]', params: { id: item.id } })}
              onLongPress={() => confirmarExclusao(item)}
            />
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(app)/residencia/nova')}
      >
        <Ionicons name="add" size={28} color={COLORS.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function ResidenciaCard({ residencia, responsavelNome, onPress, onLongPress }: {
  residencia: Residencia;
  responsavelNome?: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const syncColor = residencia.status_sync === 'sincronizado' ? COLORS.success : COLORS.warning;

  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} activeOpacity={0.8}>
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIcon}>
            <Ionicons name="home-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {residencia.logradouro}, {residencia.numero}
              {residencia.complemento ? ` - ${residencia.complemento}` : ''}
            </Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {residencia.bairro} • {residencia.cidade}/{residencia.estado}
            </Text>
            <Text style={styles.cardCep}>CEP: {residencia.cep}</Text>
            {responsavelNome && (
              <View style={styles.responsavelRow}>
                <Ionicons name="person-outline" size={12} color={COLORS.primary} />
                <Text style={styles.responsavelText}>Resp.: {responsavelNome}</Text>
              </View>
            )}
          </View>
          <View style={styles.cardActions}>
            <View style={[styles.syncDot, { backgroundColor: syncColor }]} />
            <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
          </View>
        </View>
        {residencia.tem_animais && (
          <View style={styles.tag}>
            <Ionicons name="paw-outline" size={12} color={COLORS.textLight} />
            <Text style={styles.tagText}>Animais</Text>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    margin: SPACING.md, backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.borderLight,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.text },
  list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 80 },
  card: { gap: SPACING.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  cardIcon: {
    width: 44, height: 44, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.infoLight, alignItems: 'center', justifyContent: 'center',
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  cardSubtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textLight },
  cardCep: { fontSize: FONT_SIZE.xs, color: COLORS.placeholder },
  responsavelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  responsavelText: { fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: '500' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  syncDot: { width: 8, height: 8, borderRadius: 4 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.borderLight, borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm, paddingVertical: 2, alignSelf: 'flex-start',
  },
  tagText: { fontSize: FONT_SIZE.xs, color: COLORS.textLight },
  fab: {
    position: 'absolute', bottom: SPACING.xl, right: SPACING.md,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
});
