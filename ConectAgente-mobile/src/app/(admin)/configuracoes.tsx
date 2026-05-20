import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { agenteRepository } from '../../database/repositories/agenteRepository';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../utils/constants';

type AuditEntry = Awaited<ReturnType<typeof agenteRepository.listarAuditLog>>[number];
type GlobalStats = Awaited<ReturnType<typeof agenteRepository.obterEstatisticasGlobais>>;

const ACAO_ICONS: Record<string, { icon: string; color: string }> = {
  RESET_SENHA: { icon: 'key-outline', color: COLORS.warning },
  INSERT: { icon: 'add-circle-outline', color: COLORS.success },
  UPDATE: { icon: 'create-outline', color: COLORS.info },
  DELETE: { icon: 'trash-outline', color: COLORS.error },
  LOGIN: { icon: 'log-in-outline', color: COLORS.primary },
};

export default function AdminConfiguracoes() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [limite, setLimite] = useState(20);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = useCallback(async () => {
    const [s, log] = await Promise.all([
      agenteRepository.obterEstatisticasGlobais(),
      agenteRepository.listarAuditLog(limite),
    ]);
    setStats(s);
    setAuditLog(log);
  }, [limite]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }, [carregar]);

  function carregarMais() {
    setLimite((prev) => prev + 20);
  }

  function getIconProps(acao: string) {
    const key = Object.keys(ACAO_ICONS).find((k) => acao.toUpperCase().includes(k));
    return key ? ACAO_ICONS[key] : { icon: 'ellipse-outline', color: COLORS.textLight };
  }

  function formatDateTime(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  }

  function handleResetAdmin() {
    Alert.alert(
      'Redefinir Admin',
      'Esta operação garante que as credenciais do administrador padrão existem no banco.\n\nCPF: 111.444.777-35\nSenha: Admin@2025',
      [{ text: 'OK' }]
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Sistema</Text>
          <Text style={styles.headerSub}>Configurações e auditoria</Text>
        </View>

        {/* Info do sistema */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visão geral do banco de dados</Text>
          <View style={styles.card}>
            <DBRow icon="people-outline" color="#7B1FA2" label="Agentes cadastrados" value={stats?.totalAgentes ?? 0} />
            <DBRow icon="business-outline" color={COLORS.info} label="Residências" value={stats?.totalResidencias ?? 0} />
            <DBRow icon="person-outline" color={COLORS.success} label="Moradores" value={stats?.totalMoradores ?? 0} />
            <DBRow icon="clipboard-outline" color={COLORS.primary} label="Visitas este mês" value={stats?.totalVisitasMes ?? 0} />
            <DBRow icon="today-outline" color={COLORS.warning} label="Visitas hoje" value={stats?.totalVisitasHoje ?? 0} />
            <DBRow icon="sync-outline" color={COLORS.error} label="Pendentes de sync" value={stats?.visitasPendentesSync ?? 0} />
            <DBRow icon="document-text-outline" color={COLORS.textMedium} label="Entradas no audit log" value={stats?.totalAuditLog ?? 0} last />
          </View>
        </View>

        {/* Admin info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Credenciais de acesso</Text>
          <View style={styles.card}>
            <View style={styles.credRow}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#7B1FA2" />
              <View style={{ flex: 1 }}>
                <Text style={styles.credLabel}>Administrador padrão</Text>
                <Text style={styles.credValue}>CPF: 111.444.777-35</Text>
                <Text style={styles.credValue}>Senha: Admin@2025</Text>
              </View>
              <TouchableOpacity onPress={handleResetAdmin} style={styles.infoBtn} hitSlop={8}>
                <Ionicons name="information-circle-outline" size={20} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Audit Log */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Audit Log LGPD</Text>
            <Text style={styles.sectionCount}>{auditLog.length} entradas</Text>
          </View>
          {auditLog.length === 0 ? (
            <View style={styles.emptyLog}>
              <Ionicons name="document-text-outline" size={40} color={COLORS.disabled} />
              <Text style={styles.emptyLogText}>Nenhuma entrada no log</Text>
            </View>
          ) : (
            <>
              {auditLog.map((entry) => {
                const { icon, color } = getIconProps(entry.acao);
                return (
                  <View key={entry.id} style={styles.logEntry}>
                    <View style={[styles.logIcon, { backgroundColor: color + '20' }]}>
                      <Ionicons name={icon as any} size={16} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.logTopRow}>
                        <Text style={styles.logAcao}>{entry.acao}</Text>
                        <Text style={styles.logTabela}>{entry.tabela}</Text>
                      </View>
                      <Text style={styles.logAgente} numberOfLines={1}>
                        {entry.agente_nome ?? 'Sistema'}
                      </Text>
                      <Text style={styles.logData}>{formatDateTime(entry.created_at)}</Text>
                    </View>
                  </View>
                );
              })}
              <TouchableOpacity style={styles.loadMoreBtn} onPress={carregarMais}>
                <Ionicons name="chevron-down-outline" size={16} color={COLORS.primary} />
                <Text style={styles.loadMoreText}>Carregar mais</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* App info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre o sistema</Text>
          <View style={styles.card}>
            <AppRow label="Aplicativo" value="ConectAgente" />
            <AppRow label="Versão" value="1.0.0" />
            <AppRow label="Plataforma" value={Platform.OS === 'ios' ? 'iOS' : 'Android'} />
            <AppRow label="Arquitetura" value="Offline-first (SQLite)" last />
          </View>
        </View>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function DBRow({ icon, color, label, value, last }: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  value: number;
  last?: boolean;
}) {
  return (
    <View style={[dr.row, !last && dr.border]}>
      <View style={[dr.iconWrap, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={dr.label}>{label}</Text>
      <Text style={[dr.value, { color }]}>{value}</Text>
    </View>
  );
}
const dr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 10 },
  border: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  iconWrap: { width: 32, height: 32, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.text },
  value: { fontSize: FONT_SIZE.md, fontWeight: '800' },
});

function AppRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[ar.row, !last && ar.border]}>
      <Text style={ar.label}>{label}</Text>
      <Text style={ar.value}>{value}</Text>
    </View>
  );
}
const ar = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  border: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  label: { fontSize: FONT_SIZE.sm, color: COLORS.textLight },
  value: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },

  header: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  headerSub: { fontSize: FONT_SIZE.sm, color: COLORS.textLight, marginTop: 2 },

  section: { paddingHorizontal: SPACING.md, marginBottom: SPACING.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  sectionCount: { fontSize: FONT_SIZE.sm, color: COLORS.textLight },

  card: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },

  credRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.md },
  credLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  credValue: { fontSize: FONT_SIZE.sm, color: COLORS.textMedium, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
  infoBtn: { padding: 4 },

  // Audit Log
  emptyLog: { alignItems: 'center', padding: SPACING.xl, gap: SPACING.sm },
  emptyLogText: { fontSize: FONT_SIZE.md, color: COLORS.textLight },

  logEntry: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    padding: SPACING.sm + 2, marginBottom: SPACING.xs,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  logIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  logTopRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: 2 },
  logAcao: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text },
  logTabela: {
    fontSize: 10, color: COLORS.primary, fontWeight: '600',
    backgroundColor: COLORS.surfaceAlt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full,
  },
  logAgente: { fontSize: FONT_SIZE.xs, color: COLORS.textMedium, marginBottom: 1 },
  logData: { fontSize: 10, color: COLORS.textLight },

  loadMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xs, paddingVertical: SPACING.sm, marginTop: SPACING.xs,
  },
  loadMoreText: { fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: '600' },
});
