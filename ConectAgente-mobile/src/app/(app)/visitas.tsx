import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVisitas } from '../../hooks/useVisitas';
import { Visita, StatusVisita } from '../../types';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/ui/PageHeader';
import { formatDate } from '../../utils/formatters';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../utils/constants';

type Aba = 'realizadas' | 'agendadas' | 'metas';

export default function Visitas() {
  const { visitas, agendamentos, estatisticas, isLoading, carregar, cancelarAgendamento } = useVisitas();
  const [aba, setAba] = useState<Aba>('realizadas');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function onRefresh() {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader
        title="Visitas"
        showSync={false}
        rightAction={{
          icon: 'add-circle-outline',
          onPress: () => router.push('/(app)/visita/nova'),
        }}
      />

      {/* ABAS */}
      <View style={styles.tabs}>
        {(['realizadas', 'agendadas', 'metas'] as Aba[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, aba === t && styles.tabActive]}
            onPress={() => setAba(t)}
          >
            <Text style={[styles.tabText, aba === t && styles.tabTextActive]}>
              {t === 'realizadas' ? 'Realizadas' : t === 'agendadas' ? 'Agendadas' : 'Metas'}
              {t === 'agendadas' && agendamentos.length > 0 && (
                <Text style={styles.tabBadge}> ({agendamentos.length})</Text>
              )}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* REALIZADAS */}
          {aba === 'realizadas' && (
            <FlatList
              data={visitas.filter((v) => v.status === 'realizada')}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              ListEmptyComponent={
                <EmptyState icon="clipboard-outline" title="Nenhuma visita realizada" />
              }
              renderItem={({ item }) => <VisitaCard visita={item} />}
            />
          )}

          {/* AGENDADAS */}
          {aba === 'agendadas' && (
            <FlatList
              data={agendamentos}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              ListEmptyComponent={
                <EmptyState
                  icon="calendar-outline"
                  title="Nenhuma visita agendada"
                  description="Agende visitas tocando no + acima"
                />
              }
              renderItem={({ item }) => (
                <Card style={styles.agendCard}>
                  <View style={styles.agendHeader}>
                    <Ionicons name="calendar-outline" size={20} color={COLORS.warning} />
                    <View style={styles.agendInfo}>
                      <Text style={styles.agendDate}>{formatDate(item.data_agendada)}</Text>
                      <Text style={styles.agendMotivo}>{item.motivo}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => cancelarAgendamento(item.id)}
                      style={styles.cancelBtn}
                    >
                      <Ionicons name="close-circle-outline" size={22} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                </Card>
              )}
            />
          )}

          {/* METAS */}
          {aba === 'metas' && estatisticas && (
            <ScrollViewMetas
              onNavigate={() => router.push({ pathname: '/(app)/metas', params: { backTo: '/(app)/visitas' } })}
              stats={estatisticas}
            />
          )}
        </>
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/(app)/visita/nova')}>
        <Ionicons name="add" size={28} color={COLORS.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const MOTIVOS_LABEL: Record<string, string> = {
  rotina: 'Rotina', busca_ativa: 'Busca ativa',
  urgencia: 'Urgência', retorno: 'Retorno', solicitacao: 'Por solicitação',
};

function VisitaCard({ visita }: { visita: Visita }) {
  const subtitulo = visita.motivo_visita
    ? MOTIVOS_LABEL[visita.motivo_visita] ?? visita.motivo_visita
    : visita.observacoes;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push({ pathname: '/(app)/visita/[id]', params: { id: visita.id, backTo: '/(app)/visitas' } })}
    >
      <Card style={styles.visitaCard}>
        <View style={styles.visitaRow}>
          <View style={styles.visitaIconBox}>
            <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
          </View>
          <View style={styles.visitaInfo}>
            <Text style={styles.visitaDate}>{formatDate(visita.data_visita)}</Text>
            {subtitulo && (
              <Text style={styles.visitaObs} numberOfLines={2}>{subtitulo}</Text>
            )}
          </View>
          <View style={styles.visitaRight}>
            <Badge
              label={traduzirStatus(visita.status)}
              variant={visita.status === 'realizada' ? 'success' : 'warning'}
            />
            <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function ScrollViewMetas({ stats, onNavigate }: {
  stats: ReturnType<typeof useVisitas>['estatisticas'];
  onNavigate: () => void;
}) {
  if (!stats) return null;
  return (
    <View style={styles.metasContainer}>
      <Card>
        <Text style={styles.metasTitle}>Metas do mês</Text>
        <View style={styles.metaBarContainer}>
          <View style={styles.metaBar}>
            <View
              style={[
                styles.metaBarFill,
                { width: `${Math.min(stats.percentual_meta, 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.metaPercent}>{stats.percentual_meta}%</Text>
        </View>
        <Text style={styles.metaNumbers}>
          {stats.realizadas_mes}/{stats.meta_mensal} visitas realizadas
        </Text>
        <TouchableOpacity onPress={onNavigate} style={styles.metaLink}>
          <Text style={styles.metaLinkText}>Configurar metas</Text>
          <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
        </TouchableOpacity>
      </Card>

      <View style={styles.statsRow}>
        <StatBox label="Hoje" value={stats.realizadas_hoje} />
        <StatBox label="Semana" value={stats.realizadas_semana} />
        <StatBox label="Total" value={stats.total_realizadas} />
      </View>
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <Card style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function traduzirStatus(status: string): string {
  return { realizada: 'Realizada', agendada: 'Agendada', cancelada: 'Cancelada', nao_encontrado: 'N/E' }[status] ?? status;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabs: { flexDirection: 'row', backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  tab: { flex: 1, paddingVertical: SPACING.sm, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2.5, borderBottomColor: COLORS.primary },
  tabText: { fontSize: FONT_SIZE.sm, color: COLORS.textLight, fontWeight: '600' },
  tabTextActive: { color: COLORS.primary },
  tabBadge: { color: COLORS.warning },
  list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 80 },
  visitaCard: { gap: 4 },
  visitaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  visitaIconBox: { width: 36, alignItems: 'center' },
  visitaInfo: { flex: 1 },
  visitaRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  visitaDate: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  visitaObs: { fontSize: FONT_SIZE.sm, color: COLORS.textLight },
  agendCard: { gap: 4 },
  agendHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  agendInfo: { flex: 1 },
  agendDate: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  agendMotivo: { fontSize: FONT_SIZE.sm, color: COLORS.textLight },
  cancelBtn: { padding: 4 },
  fab: {
    position: 'absolute', bottom: SPACING.xl, right: SPACING.md,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    elevation: 6,
  },
  metasContainer: { padding: SPACING.md, gap: SPACING.md },
  metasTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  metaBarContainer: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  metaBar: { flex: 1, height: 12, backgroundColor: COLORS.borderLight, borderRadius: 6, overflow: 'hidden' },
  metaBarFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 6 },
  metaPercent: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.primary },
  metaNumbers: { fontSize: FONT_SIZE.md, color: COLORS.textLight },
  metaLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SPACING.sm },
  metaLinkText: { color: COLORS.primary, fontSize: FONT_SIZE.md, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: SPACING.sm },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: FONT_SIZE.xxl, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textLight },
});
