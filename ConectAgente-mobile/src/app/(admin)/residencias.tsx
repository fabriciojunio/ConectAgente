import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, Platform, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { residenciaRepository } from '../../database/repositories/residenciaRepository';
import { moradorRepository } from '../../database/repositories/moradorRepository';
import { visitaRepository } from '../../database/repositories/visitaRepository';
import { Residencia, Morador, Visita } from '../../types';
import { SPACING, FONT_SIZE, RADIUS } from '../../utils/constants';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';

type ResidenciaExt = Residencia & { agente_nome?: string };

export default function AdminResidencias() {
  const { colors } = useTheme();
  const styles = useMemo(() => criarStyles(colors), [colors]);
  const [todas, setTodas] = useState<ResidenciaExt[]>([]);
  const [filtradas, setFiltradas] = useState<ResidenciaExt[]>([]);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selecionada, setSelecionada] = useState<ResidenciaExt | null>(null);
  const [moradores, setMoradores] = useState<Morador[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);

  const carregar = useCallback(async () => {
    const list = await residenciaRepository.listarTodos();
    setTodas(list);
    aplicarFiltro(list, query);
  }, [query]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }, [carregar]);

  function aplicarFiltro(list: ResidenciaExt[], q: string) {
    if (!q.trim()) { setFiltradas(list); return; }
    const lq = q.toLowerCase();
    setFiltradas(list.filter((r) =>
      r.logradouro.toLowerCase().includes(lq) ||
      r.bairro.toLowerCase().includes(lq) ||
      r.cidade.toLowerCase().includes(lq) ||
      r.cep.includes(lq) ||
      (r.agente_nome ?? '').toLowerCase().includes(lq)
    ));
  }

  function onSearch(text: string) {
    setQuery(text);
    aplicarFiltro(todas, text);
  }

  async function abrirDetalhes(res: ResidenciaExt) {
    setSelecionada(res);
    const [m, v] = await Promise.all([
      moradorRepository.listarPorResidencia(res.id),
      visitaRepository.listarPorResidencia(res.id),
    ]);
    setMoradores(m);
    setVisitas(v.slice(0, 5));
  }

  function renderItem({ item }: { item: ResidenciaExt }) {
    return (
      <TouchableOpacity style={styles.card} onPress={() => abrirDetalhes(item)} activeOpacity={0.75}>
        <View style={styles.iconWrap}>
          <Ionicons name="home-outline" size={20} color={colors.info} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.endereco} numberOfLines={1}>
            {item.logradouro}, {item.numero}
            {item.complemento ? ` - ${item.complemento}` : ''}
          </Text>
          <Text style={styles.bairro} numberOfLines={1}>{item.bairro} · {item.cidade}/{item.estado}</Text>
          {item.agente_nome && (
            <View style={styles.agentePill}>
              <Ionicons name="person-outline" size={10} color={colors.textLight} />
              <Text style={styles.agenteNome}>{item.agente_nome}</Text>
            </View>
          )}
        </View>
        <View style={styles.tipoBadge}>
          <Text style={styles.tipoText}>{item.tipo_imovel}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Residências</Text>
        <Text style={styles.headerCount}>{todas.length} cadastradas</Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.textLight} style={{ marginRight: SPACING.xs }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por endereço, bairro ou agente..."
          placeholderTextColor={colors.placeholder}
          value={query}
          onChangeText={onSearch}
          returnKeyType="search"
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.info]} tintColor={colors.info} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="business-outline" size={48} color={colors.disabled} />
            <Text style={styles.emptyText}>Nenhuma residência encontrada</Text>
          </View>
        }
      />

      {/* Detalhes Modal */}
      <Modal visible={!!selecionada} transparent animationType="slide" onRequestClose={() => setSelecionada(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selecionada && (
                <>
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle} numberOfLines={2}>
                      {selecionada.logradouro}, {selecionada.numero}
                    </Text>
                    <TouchableOpacity onPress={() => setSelecionada(null)} hitSlop={8}>
                      <Ionicons name="close" size={22} color={colors.textLight} />
                    </TouchableOpacity>
                  </View>

                  <InfoRow label="Bairro" value={selecionada.bairro} />
                  <InfoRow label="Cidade/Estado" value={`${selecionada.cidade}/${selecionada.estado}`} />
                  <InfoRow label="CEP" value={selecionada.cep} />
                  <InfoRow label="Tipo de imóvel" value={selecionada.tipo_imovel} />
                  <InfoRow label="Nº de cômodos" value={String(selecionada.num_comodos)} />
                  <InfoRow label="Animais" value={selecionada.tem_animais ? `Sim${selecionada.animais_info ? `, ${selecionada.animais_info}` : ''}` : 'Não'} />
                  {selecionada.agente_nome && <InfoRow label="Agente responsável" value={selecionada.agente_nome} />}
                  <InfoRow label="Cadastro" value={new Date(selecionada.created_at).toLocaleDateString('pt-BR')} />

                  {/* Moradores */}
                  <Text style={styles.sectionTitle}>Moradores ({moradores.length})</Text>
                  {moradores.length === 0 ? (
                    <Text style={styles.emptySection}>Nenhum morador cadastrado</Text>
                  ) : (
                    moradores.map((m) => (
                      <View key={m.id} style={styles.moradorRow}>
                        <View style={styles.moradorIcon}>
                          <Ionicons name="person-outline" size={16} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.moradorNome}>{m.nome}</Text>
                          <Text style={styles.moradorInfo}>
                            {m.sexo} · {new Date(m.data_nascimento).toLocaleDateString('pt-BR')}
                            {m.is_responsavel ? ' · Responsável' : ''}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}

                  {/* Visitas recentes */}
                  <Text style={styles.sectionTitle}>Visitas recentes</Text>
                  {visitas.length === 0 ? (
                    <Text style={styles.emptySection}>Nenhuma visita registrada</Text>
                  ) : (
                    visitas.map((v) => (
                      <View key={v.id} style={styles.visitaRow}>
                        <View style={[styles.statusDot, { backgroundColor: v.status === 'realizada' ? colors.success : colors.warning }]} />
                        <Text style={styles.visitaData}>{new Date(v.data_visita).toLocaleDateString('pt-BR')}</Text>
                        <View style={[styles.statusChip, { backgroundColor: v.status === 'realizada' ? colors.successLight : colors.warningLight }]}>
                          <Text style={[styles.statusText, { color: v.status === 'realizada' ? colors.success : colors.warning }]}>{v.status}</Text>
                        </View>
                      </View>
                    ))
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

function InfoRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const ir = useMemo(() => criarIr(colors), [colors]);
  return (
    <View style={ir.row}>
      <Text style={ir.label}>{label}</Text>
      <Text style={ir.value}>{value}</Text>
    </View>
  );
}
const criarIr = (colors: ThemeColors) =>
  StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  label: { fontSize: FONT_SIZE.sm, color: colors.textLight },
  value: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: colors.text, maxWidth: '60%', textAlign: 'right' },
});

const criarStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: colors.text },
  headerCount: { fontSize: FONT_SIZE.sm, color: colors.textLight, marginTop: 2 },

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
    backgroundColor: colors.infoLight, alignItems: 'center', justifyContent: 'center',
  },
  endereco: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: colors.text },
  bairro: { fontSize: FONT_SIZE.xs, color: colors.textLight, marginTop: 1 },
  agentePill: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  agenteNome: { fontSize: 10, color: colors.textLight },
  tipoBadge: {
    backgroundColor: colors.infoLight, borderRadius: RADIUS.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  tipoText: { fontSize: 10, color: colors.info, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 60, gap: SPACING.sm },
  emptyText: { fontSize: FONT_SIZE.md, color: colors.textLight },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.md, maxHeight: '85%',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md },
  sheetTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: colors.text, flex: 1, paddingRight: SPACING.sm },

  sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: colors.text, marginTop: SPACING.md, marginBottom: SPACING.sm },
  emptySection: { fontSize: FONT_SIZE.sm, color: colors.textLight, fontStyle: 'italic' },

  moradorRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.xs, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  moradorIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center',
  },
  moradorNome: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: colors.text },
  moradorInfo: { fontSize: FONT_SIZE.xs, color: colors.textLight, marginTop: 1 },

  visitaRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.xs, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  visitaData: { flex: 1, fontSize: FONT_SIZE.sm, color: colors.text },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText: { fontSize: 10, fontWeight: '700' },
});
