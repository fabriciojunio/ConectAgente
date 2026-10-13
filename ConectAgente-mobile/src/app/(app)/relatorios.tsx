import React, { useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useVisitas } from '../../hooks/useVisitas';
import { exportService, PeriodoRelatorio, FormatoRelatorio } from '../../services/exportService';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { SPACING, FONT_SIZE, RADIUS } from '../../utils/constants';
import { visitaRepository } from '../../database/repositories/visitaRepository';
import { apenasData } from '../../utils/formatters';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';

export default function Relatorios() {
  const { colors } = useTheme();
  const styles = useMemo(() => criarStyles(colors), [colors]);
  const { backTo } = useLocalSearchParams<{ backTo?: string }>();
  const { agente } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [formato, setFormato] = useState<FormatoRelatorio>('xlsx');

  async function exportar(periodo: PeriodoRelatorio) {
    if (!agente) return;
    setIsExporting(true);
    try {
      // `apenasData`, e nao `toISOString()`.
      //
      // `visitas.data_visita` guarda so a data, no formato 2026-10-13. O
      // `toISOString()` devolve a meia-noite local convertida para UTC, com
      // hora e fuso grudados, e o SQLite compara texto caractere a caractere:
      // a string mais curta perde.
      //
      // O efeito aqui era o relatorio dizer "Nenhuma visita encontrada para
      // este periodo" com a visita do dia registrada e aparecendo na lista.
      // Pior que numero errado, porque parece que o dado nao existe.
      //
      // Mesmo defeito que havia na contagem da tela inicial, em outro lugar.
      const hoje = new Date();
      let data_inicio: string;
      const data_fim = apenasData(hoje);

      if (periodo === 'dia') {
        data_inicio = apenasData(hoje);
      } else if (periodo === 'semana') {
        const inicioSemana = new Date(hoje);
        inicioSemana.setDate(hoje.getDate() - hoje.getDay());
        data_inicio = apenasData(inicioSemana);
      } else {
        data_inicio = apenasData(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
      }

      const visitas = await visitaRepository.listar(agente.id, { data_inicio, data_fim });

      if (visitas.length === 0) {
        Alert.alert('Aviso', 'Nenhuma visita encontrada para este período.');
        return;
      }

      await exportService.exportarVisitas(
        { visitas, periodo, data_referencia: apenasData(hoje) },
        formato
      );
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Erro ao exportar');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader title="Relatórios" showBack backTo={backTo} />

      <View style={styles.content}>
        {/* FORMATO */}
        <Card>
          <Text style={styles.sectionTitle}>Formato de exportação</Text>
          <View style={styles.formatRow}>
            <FormatButton
              label="Excel (.xlsx)"
              icon="grid-outline"
              active={formato === 'xlsx'}
              onPress={() => setFormato('xlsx')}
            />
            <FormatButton
              label="CSV (.csv)"
              icon="document-text-outline"
              active={formato === 'csv'}
              onPress={() => setFormato('csv')}
            />
          </View>
        </Card>

        {/* RELATÓRIOS */}
        <Text style={styles.sectionTitle}>Exportar relatório de visitas</Text>

        <PeriodoCard
          icon="today-outline"
          title="Relatório do dia"
          description="Visitas realizadas hoje"
          color={colors.primary}
          onPress={() => exportar('dia')}
          isLoading={isExporting}
        />

        <PeriodoCard
          icon="calendar-outline"
          title="Relatório semanal"
          description="Visitas desta semana"
          color={colors.info}
          onPress={() => exportar('semana')}
          isLoading={isExporting}
        />

        <PeriodoCard
          icon="bar-chart-outline"
          title="Relatório mensal"
          description="Visitas deste mês"
          color={colors.success}
          onPress={() => exportar('mes')}
          isLoading={isExporting}
        />

        <View style={styles.info}>
          <Ionicons name="information-circle-outline" size={18} color={colors.info} />
          <Text style={styles.infoText}>
            Os relatórios são gerados e compartilhados diretamente do dispositivo.
            Compatível com Excel, Google Sheets e LibreOffice.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function FormatButton({ label, icon, active, onPress }: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => criarStyles(colors), [colors]);
  return (
    <TouchableOpacity
      style={[styles.formatBtn, active && styles.formatBtnActive]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={active ? colors.primary : colors.textLight} />
      <Text style={[styles.formatBtnText, active && styles.formatBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PeriodoCard({ icon, title, description, color, onPress, isLoading }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
  onPress: () => void;
  isLoading: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => criarStyles(colors), [colors]);
  return (
    <TouchableOpacity onPress={onPress} disabled={isLoading} activeOpacity={0.8}>
      <Card style={styles.periodoCard}>
        <View style={[styles.periodoIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
        <View style={styles.periodoInfo}>
          <Text style={styles.periodoTitle}>{title}</Text>
          <Text style={styles.periodoDesc}>{description}</Text>
        </View>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Ionicons name="download-outline" size={22} color={colors.primary} />
        )}
      </Card>
    </TouchableOpacity>
  );
}

const criarStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: SPACING.md, gap: SPACING.md },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: colors.text, marginBottom: 4 },
  formatRow: { flexDirection: 'row', gap: SPACING.sm },
  formatBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xs, padding: SPACING.sm, borderRadius: RADIUS.sm,
    borderWidth: 1.5, borderColor: colors.borderLight,
  },
  formatBtnActive: { borderColor: colors.primary, backgroundColor: colors.infoLight },
  formatBtnText: { fontSize: FONT_SIZE.sm, color: colors.textLight, fontWeight: '600' },
  formatBtnTextActive: { color: colors.primary },
  periodoCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  periodoIcon: { width: 52, height: 52, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  periodoInfo: { flex: 1 },
  periodoTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: colors.text },
  periodoDesc: { fontSize: FONT_SIZE.sm, color: colors.textLight },
  info: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    backgroundColor: colors.infoLight, padding: SPACING.md, borderRadius: RADIUS.sm,
  },
  infoText: { flex: 1, fontSize: FONT_SIZE.sm, color: colors.text, lineHeight: 20 },
});
