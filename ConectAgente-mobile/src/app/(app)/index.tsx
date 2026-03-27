import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Platform, Alert, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { SyncIndicator } from '../../components/ui/SyncIndicator';
import { Card } from '../../components/ui/Card';
import { EstatisticasVisitas, Residencia } from '../../types';
import { visitaRepository } from '../../database/repositories/visitaRepository';
import { moradorRepository } from '../../database/repositories/moradorRepository';
import { residenciaRepository } from '../../database/repositories/residenciaRepository';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../utils/constants';

function obterSaudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function iniciais(nome: string): string {
  const parts = nome.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const PHOTO_KEY = 'profile_photo_uri';

export default function Dashboard() {
  const { agente, logout } = useAuth();
  const [stats, setStats] = useState<EstatisticasVisitas | null>(null);
  const [totalMoradores, setTotalMoradores] = useState(0);
  const [totalResidencias, setTotalResidencias] = useState(0);
  const [residenciasRecentes, setResidenciasRecentes] = useState<Residencia[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(PHOTO_KEY).then((uri) => { if (uri) setPhotoUri(uri); });
  }, []);

  async function handleAvatarPress() {
    Alert.alert('Foto de perfil', 'Escolha uma opção', [
      { text: 'Tirar foto', onPress: tirarFoto },
      { text: 'Escolher da galeria', onPress: escolherGaleria },
      ...(photoUri ? [{ text: 'Remover foto', style: 'destructive' as const, onPress: removerFoto }] : []),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  }

  async function tirarFoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Permita o acesso à câmera nas configurações do celular.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      await AsyncStorage.setItem(PHOTO_KEY, result.assets[0].uri);
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function escolherGaleria() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Permita o acesso à galeria nas configurações do celular.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!result.canceled && result.assets[0]) {
      await AsyncStorage.setItem(PHOTO_KEY, result.assets[0].uri);
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function removerFoto() {
    await AsyncStorage.removeItem(PHOTO_KEY);
    setPhotoUri(null);
  }

  const carregarDados = useCallback(async () => {
    if (!agente) return;
    const [e, m, r] = await Promise.all([
      visitaRepository.estatisticas(agente.id),
      moradorRepository.contar(agente.id),
      residenciaRepository.listar(agente.id),
    ]);
    setStats(e);
    setTotalMoradores(m);
    setTotalResidencias(r.length);
    setResidenciasRecentes(r.slice(0, 3));
  }, [agente]);

  // Recarrega ao entrar na tela (volta de outra tela)
  useFocusEffect(
    useCallback(() => {
      carregarDados();
    }, [carregarDados])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregarDados();
    setRefreshing(false);
  }, [carregarDados]);

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const primeiroNome = agente?.nome.split(' ')[0] ?? '';
  const percentual = stats ? Math.min(stats.percentual_meta, 100) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primaryLight}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* ── HEADER ─────────────────────────────────────────── */}
        <LinearGradient
          colors={COLORS.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          {/* Top row */}
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Text style={styles.saudacao}>{obterSaudacao()},</Text>
              <Text style={styles.nomeAgente}>{primeiroNome}</Text>
              <Text style={styles.dateText} numberOfLines={1}>
                {hoje.charAt(0).toUpperCase() + hoje.slice(1)}
              </Text>
            </View>

            <View style={styles.headerActions}>
              <SyncIndicator />
              <TouchableOpacity style={styles.avatarCircle} onPress={handleAvatarPress} activeOpacity={0.8}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{agente ? iniciais(agente.nome) : '?'}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={logout} hitSlop={8} style={styles.logoutBtn}>
                <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Unidade chip */}
          {agente?.unidade_saude ? (
            <View style={styles.unidadeChip}>
              <Ionicons name="medical-outline" size={12} color="rgba(255,255,255,0.9)" />
              <Text style={styles.unidadeText} numberOfLines={1}>{agente.unidade_saude}</Text>
            </View>
          ) : null}

          {/* Meta do mês */}
          <View style={styles.metaCard}>
            <View style={styles.metaHeader}>
              <Text style={styles.metaTitle}>Meta mensal</Text>
              <Text style={styles.metaPercent}>{percentual}%</Text>
            </View>
            <View style={styles.metaBarBg}>
              <View style={[styles.metaBarFill, { width: `${percentual}%` as any }]} />
            </View>
            <Text style={styles.metaSubtext}>
              {stats
                ? `${stats.realizadas_mes} de ${stats.meta_mensal} visitas realizadas`
                : 'Carregando meta...'}
            </Text>
          </View>
        </LinearGradient>

        {/* ── STATS ──────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard
            icon="today-outline"
            label="Hoje"
            value={stats?.realizadas_hoje ?? 0}
            accent={COLORS.primary}
            onPress={() => router.push('/(app)/visitas')}
          />
          <StatCard
            icon="calendar-outline"
            label="Semana"
            value={stats?.realizadas_semana ?? 0}
            accent={COLORS.info}
            onPress={() => router.push('/(app)/visitas')}
          />
          <StatCard
            icon="time-outline"
            label="Agendadas"
            value={stats?.total_agendadas ?? 0}
            accent={COLORS.warning}
            onPress={() => router.push('/(app)/calendario')}
          />
          <StatCard
            icon="people-outline"
            label="Pacientes"
            value={totalMoradores}
            accent={COLORS.success}
            onPress={() => router.push('/(app)/residencias')}
          />
        </View>

        {/* ── AÇÕES RÁPIDAS ───────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Ações rápidas" />
          <View style={styles.actionsGrid}>
            <QuickAction
              icon="add-circle-outline"
              label="Nova visita"
              color={COLORS.primary}
              onPress={() => router.push('/(app)/visita/nova')}
            />
            <QuickAction
              icon="home-outline"
              label="Nova residência"
              color={COLORS.info}
              onPress={() => router.push('/(app)/residencia/nova')}
            />
            <QuickAction
              icon="person-add-outline"
              label="Novo morador"
              color={COLORS.secondary}
              onPress={() => router.push('/(app)/morador/novo')}
            />
            <QuickAction
              icon="search-outline"
              label="Buscar"
              color={COLORS.warning}
              onPress={() => router.push('/(app)/busca')}
            />
            <QuickAction
              icon="document-text-outline"
              label="Relatórios"
              color={COLORS.success}
              onPress={() => router.push('/(app)/relatorios')}
            />
            <QuickAction
              icon="bar-chart-outline"
              label="Metas"
              color="#7B1FA2"
              onPress={() => router.push('/(app)/metas')}
            />
          </View>
        </View>

        {/* ── RESUMO DA ÁREA ──────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="Resumo da área" />
          <Card variant="default" padding="md">
            <AreaRow
              icon="business-outline"
              iconColor={COLORS.info}
              label="Residências cadastradas"
              value={totalResidencias}
            />
            <AreaRow
              icon="people-outline"
              iconColor={COLORS.success}
              label="Moradores cadastrados"
              value={totalMoradores}
              divider={false}
            />
          </Card>
        </View>

        {/* ── VISITAS ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader
            title="Visitas"
            action={{ label: 'Ver todas', onPress: () => router.push('/(app)/visitas') }}
          />
          <Card variant="default" padding="md">
            <AreaRow
              icon="checkmark-circle-outline"
              iconColor={COLORS.success}
              label="Realizadas este mês"
              value={stats?.realizadas_mes ?? 0}
            />
            <AreaRow
              icon="ellipse-outline"
              iconColor={COLORS.warning}
              label="Pendentes / agendadas"
              value={stats?.total_agendadas ?? 0}
            />
            <AreaRow
              icon="trending-up-outline"
              iconColor={COLORS.primary}
              label="Total geral"
              value={stats?.total_realizadas ?? 0}
              divider={false}
            />
          </Card>
        </View>

        {/* ── RESIDÊNCIAS RECENTES ─────────────────────────── */}
        {residenciasRecentes.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Residências recentes"
              action={{ label: 'Ver todas', onPress: () => router.push('/(app)/residencias') }}
            />
            {residenciasRecentes.map((r) => (
              <TouchableOpacity
                key={r.id}
                onPress={() => router.push({ pathname: '/(app)/residencia/[id]', params: { id: r.id } })}
                style={styles.recentCard}
              >
                <View style={styles.recentIcon}>
                  <Ionicons name="home-outline" size={18} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentTitle} numberOfLines={1}>
                    {r.logradouro}, {r.numero}
                  </Text>
                  <Text style={styles.recentSub} numberOfLines={1}>
                    {r.bairro} • {r.cidade}/{r.estado}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
}) {
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
  action: { fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: '600' },
});

function StatCard({ icon, label, value, accent, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  accent: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[sc.card, { borderTopColor: accent }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Ionicons name={icon} size={20} color={accent} />
      <Text style={[sc.value, { color: accent }]}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
    </TouchableOpacity>
  );
}
const sc = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    paddingVertical: SPACING.sm + 4,
    paddingHorizontal: SPACING.xs,
    gap: 2,
    borderTopWidth: 3,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  value: { fontSize: FONT_SIZE.xxl, fontWeight: '800', marginTop: 2 },
  label: { fontSize: 11, color: COLORS.textLight, fontWeight: '500', textAlign: 'center' },
});

function QuickAction({ icon, label, color, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={qa.btn} onPress={onPress} activeOpacity={0.75}>
      <View style={[qa.iconWrap, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={26} color={color} />
      </View>
      <Text style={qa.label} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}
const qa = StyleSheet.create({
  btn: { width: '31%', alignItems: 'center', gap: SPACING.xs },
  iconWrap: {
    width: 60, height: 60, borderRadius: RADIUS.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: FONT_SIZE.xs, color: COLORS.text, fontWeight: '600', textAlign: 'center' },
});

function AreaRow({ icon, iconColor, label, value, divider = true }: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: number;
  divider?: boolean;
}) {
  return (
    <View style={[ar.row, divider && ar.border]}>
      <View style={[ar.iconWrap, { backgroundColor: iconColor + '18' }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={ar.label}>{label}</Text>
      <Text style={ar.value}>{value}</Text>
    </View>
  );
}
const ar = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 10 },
  border: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  iconWrap: { width: 34, height: 34, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.text },
  value: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.primary },
});

// ─── Main styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1 },

  // Header
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl + 4,
    gap: SPACING.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: { gap: 1, flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },

  saudacao: { fontSize: FONT_SIZE.md, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  nomeAgente: { fontSize: FONT_SIZE.xxl, fontWeight: '800', color: COLORS.white, letterSpacing: -0.5 },
  dateText: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  avatarCircle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
    overflow: 'hidden',
  },
  avatarImage: { width: 42, height: 42, borderRadius: 21 },
  avatarText: { fontSize: FONT_SIZE.sm, fontWeight: '800', color: COLORS.white },
  logoutBtn: { padding: 4 },

  unidadeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  unidadeText: { fontSize: FONT_SIZE.xs, color: 'rgba(255,255,255,0.9)', fontWeight: '600', maxWidth: 220 },

  // Meta card
  metaCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: RADIUS.md,
    padding: SPACING.sm + 4,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  metaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaTitle: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  metaPercent: { fontSize: FONT_SIZE.md, fontWeight: '800', color: COLORS.white },
  metaBarBg: {
    height: 8, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 4, overflow: 'hidden',
  },
  metaBarFill: { height: '100%', backgroundColor: COLORS.white, borderRadius: 4 },
  metaSubtext: { fontSize: FONT_SIZE.xs, color: 'rgba(255,255,255,0.75)' },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginHorizontal: SPACING.md,
    marginTop: -SPACING.lg,
    marginBottom: SPACING.md,
  },

  // Sections
  section: { paddingHorizontal: SPACING.md, marginBottom: SPACING.md },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, justifyContent: 'space-between' },

  // Recent residencias
  recentCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    padding: SPACING.sm + 4, marginBottom: SPACING.xs,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  recentIcon: {
    width: 36, height: 36, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.infoLight, alignItems: 'center', justifyContent: 'center',
  },
  recentTitle: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text },
  recentSub: { fontSize: FONT_SIZE.xs, color: COLORS.textLight },
});
