import React, { useState } from 'react';
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
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../utils/constants';
import { visitaRepository } from '../../database/repositories/visitaRepository';

export default function Relatorios() {
  const { backTo } = useLocalSearchParams<{ backTo?: string }>();
  const { agente } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [formato, setFormato] = useState<FormatoRelatorio>('xlsx');

  async function exportar(periodo: PeriodoRelatorio) {
    if (!agente) return;
    setIsExporting(true);
    try {
      const hoje = new Date();
      let data_inicio: string;
      let data_fim = hoje.toISOString();

      if (periodo === 'dia') {
        data_inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString();
      } else if (periodo === 'semana') {
        const inicioSemana = new Date(hoje);
        inicioSemana.setDate(hoje.getDate() - hoje.getDay());
        data_inicio = inicioSemana.toISOString();
      } else {
        data_inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();
      }

      const visitas = await visitaRepository.listar(agente.id, { data_inicio, data_fim });

      if (visitas.length === 0) {
        Alert.alert('Aviso', 'Nenhuma visita encontrada para este período.');
        return;
      }

      await exportService.exportarVisitas(
        { visitas, periodo, data_referencia: hoje.toISOString().split('T')[0] },
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
          color={COLORS.primary}
          onPress={() => exportar('dia')}
          isLoading={isExporting}
        />

        <PeriodoCard
          icon="calendar-outline"
          title="Relatório semanal"
          description="Visitas desta semana"
          color={COLORS.info}
          onPress={() => exportar('semana')}
          isLoading={isExporting}
        />

        <PeriodoCard
          icon="bar-chart-outline"
          title="Relatório mensal"
          description="Visitas deste mês"
          color={COLORS.success}
          onPress={() => exportar('mes')}
          isLoading={isExporting}
        />

        <View style={styles.info}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.info} />
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
  return (
    <TouchableOpacity
      style={[styles.formatBtn, active && styles.formatBtnActive]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={active ? COLORS.primary : COLORS.textLight} />
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
          <ActivityIndicator color={COLORS.primary} />
        ) : (
          <Ionicons name="download-outline" size={22} color={COLORS.primary} />
        )}
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, gap: SPACING.md },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  formatRow: { flexDirection: 'row', gap: SPACING.sm },
  formatBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xs, padding: SPACING.sm, borderRadius: RADIUS.sm,
    borderWidth: 1.5, borderColor: COLORS.borderLight,
  },
  formatBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.infoLight },
  formatBtnText: { fontSize: FONT_SIZE.sm, color: COLORS.textLight, fontWeight: '600' },
  formatBtnTextActive: { color: COLORS.primary },
  periodoCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  periodoIcon: { width: 52, height: 52, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  periodoInfo: { flex: 1 },
  periodoTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  periodoDesc: { fontSize: FONT_SIZE.sm, color: COLORS.textLight },
  info: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    backgroundColor: COLORS.infoLight, padding: SPACING.md, borderRadius: RADIUS.sm,
  },
  infoText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 20 },
});
