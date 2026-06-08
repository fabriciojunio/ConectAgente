import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, Alert, Platform, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { agenteRepository } from '../../database/repositories/agenteRepository';
import { visitaRepository } from '../../database/repositories/visitaRepository';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../utils/constants';

type AgenteStats = Awaited<ReturnType<typeof agenteRepository.listarTodos>>[number];

export default function AdminAgentes() {
  const [agentes, setAgentes] = useState<AgenteStats[]>([]);
  const [filtrados, setFiltrados] = useState<AgenteStats[]>([]);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selecionado, setSelecionado] = useState<AgenteStats | null>(null);
  const [metaInput, setMetaInput] = useState('');
  const [showMetaModal, setShowMetaModal] = useState(false);

  const carregar = useCallback(async () => {
    const list = await agenteRepository.listarTodos();
    setAgentes(list);
    aplicarFiltro(list, query);
  }, [query]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }, [carregar]);

  function aplicarFiltro(list: AgenteStats[], q: string) {
    if (!q.trim()) { setFiltrados(list); return; }
    const lq = q.toLowerCase();
    setFiltrados(list.filter((a) =>
      a.nome.toLowerCase().includes(lq) ||
      a.area_atuacao.toLowerCase().includes(lq) ||
      a.unidade_saude.toLowerCase().includes(lq)
    ));
  }

  function onSearch(text: string) {
    setQuery(text);
    aplicarFiltro(agentes, text);
  }

  function abrirDetalhes(agente: AgenteStats) {
    setSelecionado(agente);
  }

  function fecharDetalhes() {
    setSelecionado(null);
  }

  async function abrirDefinirMeta(agente: AgenteStats) {
    setSelecionado(null);
    setMetaInput('');
    setShowMetaModal(true);
    // pequeno delay para fechar primeiro modal
    setTimeout(() => setSelecionado(agente), 100);
  }

  async function salvarMeta() {
    if (!selecionado) return;
    const meta = parseInt(metaInput, 10);
    if (isNaN(meta) || meta < 1) {
      Alert.alert('Valor inválido', 'Informe um número maior que zero.');
      return;
    }
    const hoje = new Date();
    await visitaRepository.definirMeta(selecionado.id, hoje.getMonth() + 1, hoje.getFullYear(), meta);
    Alert.alert('Meta definida', `Meta de ${meta} visitas definida para ${selecionado.nome}.`);
    setShowMetaModal(false);
    setSelecionado(null);
  }

  function renderItem({ item }: { item: AgenteStats }) {
    return (
      <TouchableOpacity style={styles.card} onPress={() => abrirDetalhes(item)} activeOpacity={0.75}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{iniciais(item.nome)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.nome} numberOfLines={1}>{item.nome}</Text>
          <Text style={styles.area} numberOfLines={1}>{item.area_atuacao} · {item.unidade_saude}</Text>
          <View style={styles.statsRow}>
            <StatPill icon="business-outline" value={item.total_residencias} label="res." />
            <StatPill icon="people-outline" value={item.total_moradores} label="mor." />
            <StatPill icon="clipboard-outline" value={item.visitas_mes} label="vis./mês" accent />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Agentes de Saúde</Text>
        <Text style={styles.headerCount}>{agentes.length} cadastrados</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={COLORS.textLight} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome, área ou unidade..."
          placeholderTextColor={COLORS.placeholder}
          value={query}
          onChangeText={onSearch}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => onSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtrados}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7B1FA2']} tintColor="#7B1FA2" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={COLORS.disabled} />
            <Text style={styles.emptyText}>Nenhum agente encontrado</Text>
          </View>
        }
      />

      {/* Detalhes Modal */}
      <Modal visible={!!selecionado && !showMetaModal} transparent animationType="slide" onRequestClose={fecharDetalhes}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selecionado && (
                <>
                  <View style={styles.modalHeader}>
                    <View style={[styles.avatar, styles.avatarLg]}>
                      <Text style={[styles.avatarText, { fontSize: FONT_SIZE.xl }]}>{iniciais(selecionado.nome)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalNome}>{selecionado.nome}</Text>
                      <Text style={styles.modalSub}>{selecionado.email}</Text>
                    </View>
                    <TouchableOpacity onPress={fecharDetalhes} hitSlop={8}>
                      <Ionicons name="close" size={22} color={COLORS.textLight} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.infoGrid}>
                    <InfoRow label="CPF" value={formatCpf(selecionado.cpf)} />
                    <InfoRow label="Área de atuação" value={selecionado.area_atuacao} />
                    <InfoRow label="Unidade de saúde" value={selecionado.unidade_saude} />
                    {selecionado.telefone && <InfoRow label="Telefone" value={selecionado.telefone} />}
                    <InfoRow label="Status" value={selecionado.ativo ? 'Ativo' : 'Inativo'} valueColor={selecionado.ativo ? COLORS.success : COLORS.error} />
                    <InfoRow label="Membro desde" value={new Date(selecionado.created_at).toLocaleDateString('pt-BR')} />
                  </View>

                  <Text style={styles.statsTitle}>Estatísticas</Text>
                  <View style={styles.statsBoxRow}>
                    <StatsBox label="Residências" value={selecionado.total_residencias} color={COLORS.info} />
                    <StatsBox label="Moradores" value={selecionado.total_moradores} color={COLORS.success} />
                    <StatsBox label="Visitas/mês" value={selecionado.visitas_mes} color="#7B1FA2" />
                  </View>

                  <TouchableOpacity
                    style={styles.metaBtn}
                    onPress={() => {
                      setShowMetaModal(true);
                      setMetaInput('');
                    }}
                  >
                    <Ionicons name="flag-outline" size={18} color="#fff" />
                    <Text style={styles.metaBtnText}>Definir meta mensal</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Meta Modal */}
      <Modal visible={showMetaModal} transparent animationType="fade" onRequestClose={() => setShowMetaModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: SPACING.xl }]}>
            <Text style={styles.modalNome}>Definir Meta Mensal</Text>
            {selecionado && <Text style={styles.modalSub}>{selecionado.nome}</Text>}
            <TextInput
              style={styles.metaInput}
              placeholder="Número de visitas"
              placeholderTextColor={COLORS.placeholder}
              keyboardType="number-pad"
              value={metaInput}
              onChangeText={setMetaInput}
              maxLength={4}
            />
            <View style={styles.metaActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowMetaModal(false); }}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.metaBtn2} onPress={salvarMeta}>
                <Text style={styles.metaBtnText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function iniciais(nome: string) {
  const p = nome.trim().split(' ');
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function formatCpf(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function StatPill({ icon, value, label, accent }: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <View style={[sp.pill, accent && sp.accentPill]}>
      <Ionicons name={icon} size={11} color={accent ? '#7B1FA2' : COLORS.textLight} />
      <Text style={[sp.text, accent && sp.accentText]}>{value} {label}</Text>
    </View>
  );
}
const sp = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: COLORS.background, borderRadius: RADIUS.full,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  accentPill: { backgroundColor: '#F3E5F5' },
  text: { fontSize: 10, color: COLORS.textLight },
  accentText: { color: '#7B1FA2', fontWeight: '700' },
});

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={ir.row}>
      <Text style={ir.label}>{label}</Text>
      <Text style={[ir.value, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}
const ir = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  label: { fontSize: FONT_SIZE.sm, color: COLORS.textLight },
  value: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, maxWidth: '60%', textAlign: 'right' },
});

function StatsBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[stb.box, { borderTopColor: color }]}>
      <Text style={[stb.value, { color }]}>{value}</Text>
      <Text style={stb.label}>{label}</Text>
    </View>
  );
}
const stb = StyleSheet.create({
  box: {
    flex: 1, backgroundColor: COLORS.background, borderRadius: RADIUS.md,
    borderTopWidth: 3, alignItems: 'center', paddingVertical: SPACING.sm,
  },
  value: { fontSize: FONT_SIZE.xxl, fontWeight: '800' },
  label: { fontSize: FONT_SIZE.xs, color: COLORS.textLight, marginTop: 2 },
});

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  headerCount: { fontSize: FONT_SIZE.sm, color: COLORS.textLight, marginTop: 2 },

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
  searchIcon: { marginRight: SPACING.xs },
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
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#EDE7F6', alignItems: 'center', justifyContent: 'center',
  },
  avatarLg: { width: 56, height: 56, borderRadius: 28 },
  avatarText: { fontSize: FONT_SIZE.md, fontWeight: '800', color: '#7B1FA2' },
  nome: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  area: { fontSize: FONT_SIZE.xs, color: COLORS.textLight, marginTop: 1, marginBottom: 4 },
  statsRow: { flexDirection: 'row', gap: SPACING.xs },

  empty: { alignItems: 'center', paddingTop: 60, gap: SPACING.sm },
  emptyText: { fontSize: FONT_SIZE.md, color: COLORS.textLight },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.md, maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  modalNome: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  modalSub: { fontSize: FONT_SIZE.sm, color: COLORS.textLight, marginTop: 2 },
  infoGrid: { marginBottom: SPACING.md },
  statsTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  statsBoxRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },

  metaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xs, backgroundColor: '#7B1FA2', borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 4, marginTop: SPACING.sm,
  },
  metaBtnText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: '#fff' },

  metaInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.sm, fontSize: FONT_SIZE.xl, textAlign: 'center',
    color: COLORS.text, marginVertical: SPACING.md,
  },
  metaActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 4, alignItems: 'center',
  },
  cancelBtnText: { fontSize: FONT_SIZE.md, color: COLORS.textMedium, fontWeight: '600' },
  metaBtn2: {
    flex: 1, backgroundColor: '#7B1FA2', borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm + 4, alignItems: 'center',
  },
});
