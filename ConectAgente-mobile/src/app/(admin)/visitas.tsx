import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, Platform, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { visitaRepository } from '../../database/repositories/visitaRepository';
import { agenteRepository } from '../../database/repositories/agenteRepository';
import { StatusVisita, VisitaListada } from '../../types';
import { SPACING, FONT_SIZE, RADIUS } from '../../utils/constants';
import { formatDate } from '../../utils/formatters';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';

type VisitaExt = VisitaListada;

// 'nao_realizada' nao existe em lugar nenhum: o schema aceita apenas
// 'realizada', 'agendada', 'cancelada' e 'nao_encontrado'. O filtro
// antigo nunca devolvia nada, e o status que existe de verdade nao
// tinha nem filtro nem cor.
const STATUS_OPTIONS: Array<StatusVisita | 'todas'> = [
  'todas',
  'realizada',
  'agendada',
  'cancelada',
  'nao_encontrado',
];

// O roxo de `nao_encontrado` estava escrito a mao e continuava claro no tema
// escuro. Virou par neutro da paleta, que e o que o estado significa: nem
// sucesso, nem erro.
const criarStatusColors = (
  colors: ThemeColors
): Record<StatusVisita, { bg: string; text: string }> => ({
  realizada: { bg: colors.successLight, text: colors.success },
  agendada: { bg: colors.warningLight, text: colors.warning },
  cancelada: { bg: colors.errorLight, text: colors.error },
  nao_encontrado: { bg: colors.surfaceAlt, text: colors.textMedium },
});

export default function AdminVisitas() {
  const { colors } = useTheme();
  // As folhas de detalhe vão até a borda da tela; sem descontar a faixa dos
  // botões do Android, o fim delas ficava atrás desses botões.
  const { bottom: faixaInferior } = useSafeAreaInsets();
  const STATUS_COLORS = useMemo(() => criarStatusColors(colors), [colors]);
  const styles = useMemo(() => criarStyles(colors), [colors]);
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
    const sc = item.status in STATUS_COLORS ? STATUS_COLORS[item.status as StatusVisita] : { bg: colors.background, text: colors.text };
    return (
      <TouchableOpacity style={styles.card} onPress={() => setSelecionada(item)} activeOpacity={0.75}>
        <View style={styles.iconWrap}>
          <Ionicons name="clipboard-outline" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.endereco} numberOfLines={1}>
            {item.logradouro ?? '-'}, {item.numero ?? ''}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {item.agente_nome ?? 'Agente'} · {formatDate(item.data_visita)}
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
          <Ionicons name="filter-outline" size={18} color={filtroAtivo ? '#fff' : colors.primary} />
          <Text style={[styles.filtroBtnText, filtroAtivo && { color: '#fff' }]}>Filtros</Text>
          {filtroAtivo && <View style={styles.filtroBadge} />}
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.textLight} style={{ marginRight: SPACING.xs }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por endereço ou agente..."
          placeholderTextColor={colors.placeholder}
          value={query}
          onChangeText={onSearch}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => onSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtradas}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="clipboard-outline" size={48} color={colors.disabled} />
            <Text style={styles.emptyText}>Nenhuma visita encontrada</Text>
          </View>
        }
      />

      {/* Filtros Modal */}
      <Modal visible={showFiltros} transparent animationType="slide" onRequestClose={() => setShowFiltros(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { paddingBottom: SPACING.md + faixaInferior }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filtros</Text>
              <TouchableOpacity onPress={() => setShowFiltros(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textLight} />
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
                <Text style={[styles.agenteOptText, !agenteFiltro && { color: colors.primary, fontWeight: '700' }]}>
                  Todos os agentes
                </Text>
              </TouchableOpacity>
              {agentes.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.agenteOpt, agenteFiltro === a.id && styles.agenteOptActive]}
                  onPress={() => aplicarAgente(a.id)}
                >
                  <Text style={[styles.agenteOptText, agenteFiltro === a.id && { color: colors.primary, fontWeight: '700' }]}>
                    {a.nome}
                  </Text>
                  {agenteFiltro === a.id && <Ionicons name="checkmark" size={16} color={colors.primary} />}
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
          <View style={[styles.sheet, { paddingBottom: SPACING.md + faixaInferior }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selecionada && (
                <>
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>Detalhes da Visita</Text>
                    <TouchableOpacity onPress={() => setSelecionada(null)} hitSlop={8}>
                      <Ionicons name="close" size={22} color={colors.textLight} />
                    </TouchableOpacity>
                  </View>

                  {(() => {
                    const sc = selecionada.status in STATUS_COLORS
                      ? STATUS_COLORS[selecionada.status as StatusVisita]
                      : { bg: colors.background, text: colors.text };
                    return (
                      <View style={[styles.statusBanner, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.statusBannerText, { color: sc.text }]}>{selecionada.status.toUpperCase()}</Text>
                      </View>
                    );
                  })()}

                  <InfoRow label="Endereço" value={`${selecionada.logradouro ?? '-'}, ${selecionada.numero ?? ''}`} />
                  <InfoRow label="Bairro" value={selecionada.bairro ?? '-'} />
                  <InfoRow label="Agente" value={selecionada.agente_nome ?? '-'} />
                  <InfoRow label="Data" value={formatDate(selecionada.data_visita)} />
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
  const { colors } = useTheme();
  const ir = useMemo(() => criarIr(colors), [colors]);
  return (
    <View style={ir.row}>
      <Text style={ir.label}>{label}</Text>
      <Text style={ir.value} numberOfLines={3}>{value}</Text>
    </View>
  );
}
const criarIr = (colors: ThemeColors) =>
  StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  label: { fontSize: FONT_SIZE.sm, color: colors.textLight, flex: 1 },
  value: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: colors.text, maxWidth: '55%', textAlign: 'right' },
});

function CheckRow({ label, value }: { label: string; value?: boolean | null }) {
  const { colors } = useTheme();
  const cr = useMemo(() => criarCr(colors), [colors]);
  const icon = value == null ? 'remove-outline' : value ? 'checkmark-circle' : 'close-circle';
  const color = value == null ? colors.textLight : value ? colors.success : colors.error;
  return (
    <View style={cr.row}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={cr.label}>{label}</Text>
    </View>
  );
}
const criarCr = (colors: ThemeColors) =>
  StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  label: { fontSize: FONT_SIZE.sm, color: colors.text },
});

const criarStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: colors.text },
  headerCount: { fontSize: FONT_SIZE.sm, color: colors.textLight, marginTop: 2 },

  filtroBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: colors.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm, paddingVertical: 8,
  },
  filtroBtnActive: { backgroundColor: colors.primary },
  filtroBtnText: { fontSize: FONT_SIZE.sm, color: colors.primary, fontWeight: '600' },
  filtroBadge: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm,
    borderWidth: 1, borderColor: colors.borderLight, marginBottom: SPACING.sm,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  searchInput: { flex: 1, height: 44, fontSize: FONT_SIZE.md, color: colors.text },

  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: colors.card, borderRadius: RADIUS.md,
    padding: SPACING.sm + 4, marginBottom: SPACING.sm,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: RADIUS.sm,
    backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center',
  },
  endereco: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: colors.text },
  sub: { fontSize: FONT_SIZE.xs, color: colors.textLight, marginTop: 1 },
  motivo: { fontSize: FONT_SIZE.xs, color: colors.textMedium, marginTop: 2 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText: { fontSize: 10, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 60, gap: SPACING.sm },
  emptyText: { fontSize: FONT_SIZE.md, color: colors.textLight },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.md, maxHeight: '88%',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  sheetTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: colors.text },

  statusBanner: {
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm,
    alignItems: 'center', marginBottom: SPACING.sm,
  },
  statusBannerText: { fontSize: FONT_SIZE.md, fontWeight: '800', letterSpacing: 1 },
  sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: colors.text, marginTop: SPACING.md, marginBottom: 4 },

  // Filtros
  filterLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: colors.text, marginBottom: SPACING.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.md },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: FONT_SIZE.sm, color: colors.text },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  agenteOpt: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  agenteOptActive: { backgroundColor: colors.surfaceAlt, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.xs },
  agenteOptText: { fontSize: FONT_SIZE.sm, color: colors.text },

  clearBtn: {
    marginTop: SPACING.md, borderWidth: 1, borderColor: colors.error, borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm, alignItems: 'center',
  },
  clearBtnText: { fontSize: FONT_SIZE.md, color: colors.error, fontWeight: '600' },
});
