import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useVisitas } from '../../hooks/useVisitas';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/button';
import { PageHeader } from '../../components/ui/PageHeader';
import { SPACING, FONT_SIZE, RADIUS } from '../../utils/constants';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function Metas() {
  const { colors } = useTheme();
  const styles = useMemo(() => criarStyles(colors), [colors]);
  const { backTo } = useLocalSearchParams<{ backTo?: string }>();
  const { estatisticas, definirMeta } = useVisitas();
  const [novaMeta, setNovaMeta] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const hoje = new Date();
  const mes = hoje.getMonth();
  const ano = hoje.getFullYear();

  async function salvarMeta() {
    const meta = parseInt(novaMeta, 10);
    if (isNaN(meta) || meta <= 0) {
      Alert.alert('Inválido', 'Informe um número válido de visitas');
      return;
    }
    setIsSaving(true);
    try {
      await definirMeta(mes + 1, ano, meta);
      setNovaMeta('');
      Alert.alert('Salvo', `Meta de ${meta} visitas definida para ${MESES[mes]}!`);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a meta');
    } finally {
      setIsSaving(false);
    }
  }

  const stats = estatisticas;
  const percentual = stats?.percentual_meta ?? 0;
  const cor = percentual >= 100 ? colors.success : percentual >= 70 ? colors.warning : colors.error;

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader title="Controle de Metas" showBack backTo={backTo ?? '/(app)/visitas'} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* MES ATUAL */}
        <Card>
          <Text style={styles.mesTitle}>{MESES[mes]} {ano}</Text>
          <Text style={styles.metaAtual}>
            Meta: {stats?.meta_mensal ?? 0} visitas
          </Text>

          {stats && stats.meta_mensal > 0 && (
            <>
              <View style={styles.barWrapper}>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${Math.min(percentual, 100)}%`, backgroundColor: cor }]} />
                </View>
                <Text style={[styles.percent, { color: cor }]}>{percentual}%</Text>
              </View>
              <Text style={styles.metaCount}>
                {stats.realizadas_mes} de {stats.meta_mensal} realizadas
              </Text>
            </>
          )}
        </Card>

        {/* DEFINIR META */}
        <Card>
          <Text style={styles.cardTitle}>Definir meta para {MESES[mes]}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.metaInput}
              value={novaMeta}
              onChangeText={setNovaMeta}
              keyboardType="numeric"
              placeholder="Número de visitas"
              placeholderTextColor={colors.placeholder}
            />
            <Button title="Salvar" onPress={salvarMeta} loading={isSaving} />
          </View>
        </Card>

        {/* RESUMO */}
        <Card>
          <Text style={styles.cardTitle}>Resumo de produtividade</Text>
          <View style={styles.statsGrid}>
            <StatItem icon="today-outline" label="Hoje" value={stats?.realizadas_hoje ?? 0} color={colors.primary} />
            <StatItem icon="calendar-outline" label="Semana" value={stats?.realizadas_semana ?? 0} color={colors.info} />
            <StatItem icon="checkmark-circle-outline" label="Mês" value={stats?.realizadas_mes ?? 0} color={colors.success} />
            <StatItem icon="time-outline" label="Agendadas" value={stats?.total_agendadas ?? 0} color={colors.warning} />
          </View>
        </Card>

        {/* DICA */}
        <View style={styles.dica}>
          <Ionicons name="bulb-outline" size={20} color={colors.warning} />
          <Text style={styles.dicaText}>
            A meta recomendada pelo Ministério da Saúde é de{' '}
            <Text style={{ fontWeight: '700' }}>400 visitas por mês</Text> por ACS em área urbana
            e <Text style={{ fontWeight: '700' }}>250</Text> em área rural.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatItem({ icon, label, value, color }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  color: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => criarStyles(colors), [colors]);
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const criarStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },
  mesTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: colors.primary },
  metaAtual: { fontSize: FONT_SIZE.md, color: colors.textLight, marginTop: 4 },
  barWrapper: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md },
  barBg: { flex: 1, height: 16, backgroundColor: colors.borderLight, borderRadius: 8, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 8 },
  percent: { fontSize: FONT_SIZE.xl, fontWeight: '800', minWidth: 48, textAlign: 'right' },
  metaCount: { fontSize: FONT_SIZE.sm, color: colors.textLight, marginTop: 4 },
  cardTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: colors.text, marginBottom: SPACING.sm },
  inputRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  metaInput: {
    flex: 1, height: 50, borderRadius: RADIUS.sm, borderWidth: 1.5,
    borderColor: colors.border, paddingHorizontal: SPACING.sm,
    fontSize: FONT_SIZE.xl, fontWeight: '700', color: colors.text,
    textAlign: 'center',
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  statItem: { flex: 1, minWidth: '45%', alignItems: 'center', gap: 4, paddingVertical: SPACING.sm },
  statValue: { fontSize: FONT_SIZE.xxl, fontWeight: '800' },
  statLabel: { fontSize: FONT_SIZE.xs, color: colors.textLight },
  dica: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    backgroundColor: colors.warningLight, padding: SPACING.md, borderRadius: RADIUS.sm,
  },
  dicaText: { flex: 1, fontSize: FONT_SIZE.sm, color: colors.text, lineHeight: 20 },
});
