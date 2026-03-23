import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, Platform, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { visitaRepository } from '../../database/repositories/visitaRepository';
import { agenteRepository } from '../../database/repositories/agenteRepository';
import { Visita, StatusVisita } from '../../types';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../utils/constants';

type VisitaExt = Visita & { agente_nome?: string };

const STATUS_OPTIONS: Array<StatusVisita | 'todas'> = ['todas', 'realizada', 'agendada', 'cancelada', 'nao_realizada'];

const STATUS_COLORS: Record<StatusVisita, { bg: string; text: string }> = {
  realizada: { bg: COLORS.successLight, text: COLORS.success },
  agendada: { bg: COLORS.warningLight, text: COLORS.warning },
  cancelada: { bg: COLORS.errorLight, text: COLORS.error },
  nao_realizada: { bg: '#F3E5F5', text: '#7B1FA2' },
};

export default function AdminVisitas() {
  const [todas, setTodas] = useState<VisitaExt[]>([]);
  const [filtradas, setFiltradas] = useState<VisitaExt[]>([]);
  const [query, setQuery] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<StatusVisita | 'todas'>('todas');
  const [agenteFiltro, setAgenteFiltro] = useState<string>('');
  const [agentes, setAgentes] = useState<Array<{ id: string; nome: string }>>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selecionada, setSelecionada] = useState<VisitaExt | null>(null);
  const [showFiltros, setShowFiltros] = useState(false);

  const carregar = useCallback(async () => {
    const [list, ags] = await Promise.all([
      visitaRepository.listarTodas({
        status: statusFiltro !== 'todas' ? statusFiltro : undefined,
        agente_id: agenteFiltro || undefined,
      }),
      agenteRepository.listarTodos(),
    ]);
    setTodas(list);
    setAgentes(ags.map((a) => ({ id: a.id, nome: a.nome })));
    aplicarQuery(list, query);
  }, [statusFiltro, agenteFiltro, query]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }, [carregar]);

  function aplicarQuery(list: VisitaExt[], q: string) {
    if (!q.trim()) { setFiltradas(list); return; }
    const lq = q.toLowerCase();
    setFiltradas(list.filter((v) =>
      (v.logradouro ?? '').toLowerCase().includes(lq) ||
      (v.bairro ?? '').toLowerCase().includes(lq) ||
      (v.agente_nome ?? '').toLowerCase().includes(lq) ||
      (v.motivo_visita ?? '').toLowerCase().includes(lq)
    ));
  }

  function onSearch(text: string) {
    setQuery(text);
    aplicarQuery(todas, text);
  }

  function aplicarStatus(s: StatusVisita | 'todas') {
    setStatusFiltro(s);
    setShowFiltros(false);
  }

  function aplicarAgente(id: string) {
    setAgenteFiltro(id);
    setShowFiltros(false);
  }

  function renderItem({ item }: { item: VisitaExt }) {
    const sc = item.status in STATUS_COLORS ? STATUS_COLORS[item.status as StatusVisita] : { bg: COLORS.background, text: COLORS.text };
    return (
      <TouchableOpacity style={styles.card} onPress={() => setSelecionada(item)} activeOpacity={0.75}>
        <View style={styles.iconWrap}>
          <Ionicons name="clipboard-outline" size={18} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.endereco} numberOfLines={1}>
            {item.logradouro ?? '—'}, {item.numero ?? ''}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {item.agente_nome ?? 'Agente'} · {new Date(item.data_visita).toLocaleDateString('pt-BR')}
          </Text>
          {item.motivo_visita ? (
            <Text style={styles.motivo} numberOfLines={1}>{item.motivo_visita}</Text>
          ) : null}
        </View>
        <View style={[styles.statusChip, { backgroundColor: sc.bg }]}>
          <Text style={[styles.statusText, { color: sc.text }]}>{item.status}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  const filtroAtivo = statusFiltro !== 'todas' || !!agenteFiltro;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Visitas</Text>
          <Text style={styles.headerCount}>{filtradas.length} registros</Text>
        </View>
        <TouchableOpacity
          style={[styles.filtroBtn, filtroAtivo && styles.filtroBtnActive]}
          onPress={() => setShowFiltros(true)}
        >
          <Ionicons name="filter-outline" size={18} color={filtroAtivo ? '#fff' : COLORS.primary} />
          <Text style={[styles.filtroBtnText, filtroAtivo && { color: '#fff' }]}>Filtros</Text>
          {filtroAtivo && <View style={styles.filtroBadge} />}
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={COLORS.textLight} style={{ marginRight: SPACING.xs }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por endereço ou agente..."
          placeholderTextColor={COLORS.placeholder}
          value={query}
          onChangeText={onSearch}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => onSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtradas}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="clipboard-outline" size={48} color={COLORS.disabled} />
            <Text style={styles.emptyText}>Nenhuma visita encontrada</Text>
          </View>
        }
      />

      {/* Filtros Modal */}
      <Modal visible={showFiltros} transparent animationType="slide" onRequestClose={() => setShowFiltros(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filtros</Text>
              <TouchableOpacity onPress={() => setShowFiltros(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterLabel}>Status</Text>
            <View style={styles.chipRow}>
              {STATUS_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, statusFiltro === s && styles.chipActive]}
                  onPress={() => aplicarStatus(s)}
                >
                  <Text style={[styles.chipText, statusFiltro === s && styles.chipTextActive]}>
                    {s === 'todas' ? 'Todas' : s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>Agente</Text>
            <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.agenteOpt, !agenteFiltro && styles.agenteOptActive]}
                onPress={() => aplicarAgente('')}
              >
                <Text style={[styles.agenteOptText, !agenteFiltro && { color: COLORS.primary, fontWeight: '700' }]}>
                  Todos os agentes
                </Text>
              </TouchableOpacity>
              {agentes.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.agenteOpt, agenteFiltro === a.id && styles.agenteOptActive]}
                  onPress={() => aplicarAgente(a.id)}
                >
                  <Text style={[styles.agenteOptText, agenteFiltro === a.id && { color: COLORS.primary, fontWeight: '700' }]}>
                    {a.nome}
                  </Text>
                  {agenteFiltro === a.id && <Ionicons name="checkmark" size={16} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => { setStatusFiltro('todas'); setAgenteFiltro(''); setShowFiltros(false); }}
            >
              <Text style={styles.clearBtnText}>Limpar filtros</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Detalhes Modal */}
      <Modal visible={!!selecionada} transparent animationType="slide" onRequestClose={() => setSelecionada(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selecionada && (
                <>
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>Detalhes da Visita</Text>
                    <TouchableOpacity onPress={() => setSelecionada(null)} hitSlop={8}>
                      <Ionicons name="close" size={22} color={COLORS.textLight} />
                    </TouchableOpacity>
                  </View>

                  {(() => {
                    const sc = selecionada.status in STATUS_COLORS
                      ? STATUS_COLORS[selecionada.status as StatusVisita]
                      : { bg: COLORS.background, text: COLORS.text };
                    return (
                      <View style={[styles.statusBanner, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.statusBannerText, { color: sc.text }]}>{selecionada.status.toUpperCase()}</Text>
                      </View>
                    );
                  })()}

                  <InfoRow label="Endereço" value={`${selecionada.logradouro ?? '—'}, ${selecionada.numero ?? ''}`} />
                  <InfoRow label="Bairro" value={selecionada.bairro ?? '—'} />
                  <InfoRow label="Agente" value={selecionada.agente_nome ?? '—'} />
                  <InfoRow label="Data" value={new Date(selecionada.data_visita).toLocaleDateString('pt-BR')} />
                  {selecionada.motivo_visita && <InfoRow label="Motivo" value={selecionada.motivo_visita} />}
                  {selecionada.queixas && <InfoRow label="Queixas" value={selecionada.queixas} />}
                  {selecionada.observacoes && <InfoRow label="Observações" value={selecionada.observacoes} />}

                  {/* Sinais vitais */}
                  {(selecionada.pa_visita || selecionada.glicemia_visita || selecionada.peso_visita) && (
                    <>
                      <Text style={styles.sectionTitle}>Sinais vitais</Text>
                      {selecionada.pa_visita && <InfoRow label="Pressão arterial" value={selecionada.pa_visita} />}
                      {selecionada.glicemia_visita && <InfoRow label="Glicemia" value={selecionada.glicemia_visita} />}
                      {selecionada.peso_visita && <InfoRow label="Peso" value={selecionada.peso_visita} />}
                    </>
                  )}

                  {/* Checklist */}
                  <Text style={styles.sectionTitle}>Checklist</Text>
                  <CheckRow label="Medicamentos em dia" value={selecionada.medicamentos_em_dia} />
                  <CheckRow label="Cartão de vacinas em dia" value={selecionada.cartao_vacinas_em_dia} />
                  <CheckRow label="Precisa agendamento" value={selecionada.precisa_agendamento} />
                  {selecionada.especialidade_agendamento && (
                    <InfoRow label="Especialidade" value={selecionada.especialidade_agendamento} />
                  )}
                  {selecionada.encaminhamentos && (
                    <InfoRow label="Encaminhamentos" value={selecionada.encaminhamentos} />
                  )}

                  <View style={{ height: SPACING.xl }} />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={ir.row}>
      <Text style={ir.label}>{label}</Text>
      <Text style={ir.value} numberOfLines={3}>{value}</Text>
    </View>
  );
}
const ir = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  label: { fontSize: FONT_SIZE.sm, color: COLORS.textLight, flex: 1 },
  value: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, maxWidth: '55%', textAlign: 'right' },
});

function CheckRow({ label, value }: { label: string; value?: boolean | null }) {
  const icon = value == null ? 'remove-outline' : value ? 'checkmark-circle' : 'close-circle';
  const color = value == null ? COLORS.textLight : value ? COLORS.success : COLORS.error;
  return (
    <View style={cr.row}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={cr.label}>{label}</Text>
    </View>
  );
}
const cr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  label: { fontSize: FONT_SIZE.sm, color: COLORS.text },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  headerCount: { fontSize: FONT_SIZE.sm, color: COLORS.textLight, marginTop: 2 },

  filtroBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm, paddingVertical: 8,
  },
  filtroBtnActive: { backgroundColor: COLORS.primary },
  filtroBtnText: { fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: '600' },
  filtroBadge: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.borderLight, marginBottom: SPACING.sm,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  searchInput: { flex: 1, height: 44, fontSize: FONT_SIZE.md, color: COLORS.text },

  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    padding: SPACING.sm + 4, marginBottom: SPACING.sm,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center',
  },
  endereco: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text },
  sub: { fontSize: FONT_SIZE.xs, color: COLORS.textLight, marginTop: 1 },
  motivo: { fontSize: FONT_SIZE.xs, color: COLORS.textMedium, marginTop: 2 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText: { fontSize: 10, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 60, gap: SPACING.sm },
  emptyText: { fontSize: FONT_SIZE.md, color: COLORS.textLight },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.md, maxHeight: '88%',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  sheetTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },

  statusBanner: {
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm,
    alignItems: 'center', marginBottom: SPACING.sm,
  },
  statusBannerText: { fontSize: FONT_SIZE.md, fontWeight: '800', letterSpacing: 1 },
  sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginTop: SPACING.md, marginBottom: 4 },

  // Filtros
  filterLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.md },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: FONT_SIZE.sm, color: COLORS.text },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  agenteOpt: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  agenteOptActive: { backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.xs },
  agenteOptText: { fontSize: FONT_SIZE.sm, color: COLORS.text },

  clearBtn: {
    marginTop: SPACING.md, borderWidth: 1, borderColor: COLORS.error, borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm, alignItems: 'center',
  },
  clearBtnText: { fontSize: FONT_SIZE.md, color: COLORS.error, fontWeight: '600' },
});
