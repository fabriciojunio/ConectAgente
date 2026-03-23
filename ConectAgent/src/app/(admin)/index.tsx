import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { agenteRepository } from '../../database/repositories/agenteRepository';
import { visitaRepository } from '../../database/repositories/visitaRepository';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../utils/constants';

const ADMIN_GRADIENT = ['#4A148C', '#7B1FA2', '#AB47BC'] as const;

type GlobalStats = Awaited<ReturnType<typeof agenteRepository.obterEstatisticasGlobais>>;
type UltimaVisita = Awaited<ReturnType<typeof visitaRepository.obterUltimasVisitas>>[number];
type AgenteStats = Awaited<ReturnType<typeof agenteRepository.listarTodos>>[number];

export default function AdminDashboard() {
  const { agente, logout } = useAuth();
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [ultimasVisitas, setUltimasVisitas] = useState<UltimaVisita[]>([]);
  const [topAgentes, setTopAgentes] = useState<AgenteStats[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const carregarDados = useCallback(async () => {
    const [s, uv, agentes] = await Promise.all([
      agenteRepository.obterEstatisticasGlobais(),
      visitaRepository.obterUltimasVisitas(5),
      agenteRepository.listarTodos(),
    ]);
    setStats(s);
    setUltimasVisitas(uv);
    // ordena por visitas do mês
    setTopAgentes([...agentes].sort((a, b) => b.visitas_mes - a.visitas_mes).slice(0, 3));
  }, []);

  useFocusEffect(useCallback(() => { carregarDados(); }, [carregarDados]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregarDados();
    setRefreshing(false);
  }, [carregarDados]);

  function handleLogout() {
    Alert.alert('Sair', 'Deseja encerrar a sessão de administrador?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#AB47BC"
            colors={['#7B1FA2']}
          />
        }
      >
        {/* HEADER */}
        <LinearGradient
          colors={ADMIN_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <View style={styles.adminBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#fff" />
                <Text style={styles.adminBadgeText}>ADMINISTRADOR</Text>
              </View>
              <Text style={styles.headerTitle}>Painel de Controle</Text>
              <Text style={styles.headerSub}>{agente?.nome ?? 'Admin'}</Text>
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} hitSlop={8}>
              <Ionicons name="log-out-outline" size={22} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* STATS GLOBAIS */}
        <View style={styles.statsGrid}>
          <StatBox icon="people-outline" label="Agentes" value={stats?.totalAgentes ?? 0} color="#7B1FA2" />
          <StatBox icon="business-outline" label="Residências" value={stats?.totalResidencias ?? 0} color={COLORS.info} />
          <StatBox icon="person-outline" label="Moradores" value={stats?.totalMoradores ?? 0} color={COLORS.success} />
          <StatBox icon="today-outline" label="Visitas hoje" value={stats?.totalVisitasHoje ?? 0} color={COLORS.warning} />
          <StatBox icon="calendar-outline" label="Visitas/mês" value={stats?.totalVisitasMes ?? 0} color={COLORS.primary} />
          <StatBox icon="sync-outline" label="Pend. sync" value={stats?.visitasPendentesSync ?? 0} color={COLORS.error} />
        </View>

        {/* AÇÕES RÁPIDAS */}
        <View style={styles.section}>
          <SectionHeader title="Navegação rápida" />
          <View style={styles.quickRow}>
            <QuickBtn icon="people-outline" label="Agentes" color="#7B1FA2" onPress={() => router.push('/(admin)/agentes')} />
            <QuickBtn icon="business-outline" label="Residências" color={COLORS.info} onPress={() => router.push('/(admin)/residencias')} />
            <QuickBtn icon="clipboard-outline" label="Visitas" color={COLORS.primary} onPress={() => router.push('/(admin)/visitas')} />
            <QuickBtn icon="settings-outline" label="Sistema" color={COLORS.textMedium} onPress={() => router.push('/(admin)/configuracoes')} />
          </View>
        </View>

        {/* TOP AGENTES */}
        {topAgentes.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Top agentes (mês)"
              action={{ label: 'Ver todos', onPress: () => router.push('/(admin)/agentes') }}
            />
            {topAgentes.map((a, i) => (
              <View key={a.id} style={styles.agenteRow}>
                <View style={[styles.rankBadge, { backgroundColor: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : '#CD7F32' }]}>
                  <Text style={styles.rankText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.agenteName} numberOfLines={1}>{a.nome}</Text>
                  <Text style={styles.agenteArea} numberOfLines={1}>{a.area_atuacao} · {a.unidade_saude}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.visitasCount}>{a.visitas_mes}</Text>
                  <Text style={styles.visitasLabel}>visitas</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ÚLTIMAS VISITAS */}
        {ultimasVisitas.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Últimas visitas registradas"
              action={{ label: 'Ver todas', onPress: () => router.push('/(admin)/visitas') }}
            />
            {ultimasVisitas.map((v) => (
              <View key={v.id} style={styles.visitaRow}>
                <View style={[styles.statusDot, { backgroundColor: v.status === 'realizada' ? COLORS.success : COLORS.warning }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.visitaEndereco} numberOfLines={1}>
                    {v.logradouro}, {v.numero} — {v.bairro}
                  </Text>
                  <Text style={styles.visitaInfo} numberOfLines={1}>
                    {(v as any).agente_nome ?? 'Agente'} · {new Date(v.data_visita).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
                <View style={[styles.statusChip, { backgroundColor: v.status === 'realizada' ? COLORS.successLight : COLORS.warningLight }]}>
                  <Text style={[styles.statusChipText, { color: v.status === 'realizada' ? COLORS.success : COLORS.warning }]}>
                    {v.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function SectionHeader({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={sh.row}>
      <Text style={sh.title}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={action.onPress} hitSlop={8}>
          <Text style={sh.action}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const sh = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  title: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  action: { fontSize: FONT_SIZE.sm, color: '#7B1FA2', fontWeight: '600' },
});

function StatBox({ icon, label, value, color }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={[sb.box, { borderTopColor: color }]}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[sb.value, { color }]}>{value}</Text>
      <Text style={sb.label}>{label}</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  box: {
    width: '30%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    paddingVertical: SPACING.sm + 4,
    paddingHorizontal: SPACING.xs,
    gap: 2,
    borderTopWidth: 3,
    marginBottom: SPACING.xs,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  value: { fontSize: FONT_SIZE.xxl, fontWeight: '800', marginTop: 2 },
  label: { fontSize: 10, color: COLORS.textLight, fontWeight: '500', textAlign: 'center' },
});

function QuickBtn({ icon, label, color, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={qb.btn} onPress={onPress} activeOpacity={0.75}>
      <View style={[qb.wrap, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={26} color={color} />
      </View>
      <Text style={qb.label}>{label}</Text>
    </TouchableOpacity>
  );
}
const qb = StyleSheet.create({
  btn: { alignItems: 'center', gap: SPACING.xs, flex: 1 },
  wrap: { width: 56, height: 56, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: FONT_SIZE.xs, color: COLORS.text, fontWeight: '600', textAlign: 'center' },
});

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#4A148C' },
  scroll: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1 },

  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start' },
  adminBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start', marginBottom: 6,
  },
  adminBadgeText: { fontSize: 10, color: '#fff', fontWeight: '800', letterSpacing: 1 },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerSub: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  logoutBtn: { padding: 4, marginTop: 4 },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    justifyContent: 'space-between',
    marginTop: -SPACING.lg,
    marginBottom: SPACING.md,
  },

  section: { paddingHorizontal: SPACING.md, marginBottom: SPACING.md },
  quickRow: { flexDirection: 'row', gap: SPACING.xs },

  agenteRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    padding: SPACING.sm + 4, marginBottom: SPACING.xs,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  rankBadge: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  rankText: { fontSize: FONT_SIZE.sm, fontWeight: '800', color: '#fff' },
  agenteName: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text },
  agenteArea: { fontSize: FONT_SIZE.xs, color: COLORS.textLight, marginTop: 1 },
  visitasCount: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: '#7B1FA2' },
  visitasLabel: { fontSize: 10, color: COLORS.textLight },

  visitaRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    padding: SPACING.sm + 2, marginBottom: SPACING.xs,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  visitaEndereco: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text },
  visitaInfo: { fontSize: FONT_SIZE.xs, color: COLORS.textLight, marginTop: 1 },
  statusChip: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  statusChipText: { fontSize: 10, fontWeight: '700' },
});
