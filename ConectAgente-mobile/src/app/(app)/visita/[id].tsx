import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { visitaRepository } from '../../../database/repositories/visitaRepository';
import { Visita } from '../../../types';
import { formatDate, formatDateTime } from '../../../utils/formatters';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../../utils/constants';

const MOTIVOS_LABEL: Record<string, string> = {
  rotina: 'Rotina',
  busca_ativa: 'Busca ativa',
  urgencia: 'Urgência',
  retorno: 'Retorno',
  solicitacao: 'Por solicitação',
};

const STATUS_LABEL: Record<string, string> = {
  realizada: 'Realizada',
  agendada: 'Agendada',
  cancelada: 'Cancelada',
  nao_encontrado: 'Não encontrado',
};

const STATUS_COLOR: Record<string, string> = {
  realizada: COLORS.success,
  agendada: COLORS.warning,
  cancelada: COLORS.error,
  nao_encontrado: COLORS.textLight,
};

export default function DetalheVisita() {
  const { id, backTo } = useLocalSearchParams<{ id: string; backTo?: string }>();
  const [visita, setVisita] = useState<Visita | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    visitaRepository.buscarPorId(id).then((v) => {
      setVisita(v);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <PageHeader title="Detalhes da Visita" showBack backTo={backTo} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!visita) {
    return (
      <SafeAreaView style={styles.container}>
        <PageHeader title="Detalhes da Visita" showBack backTo={backTo} />
        <View style={styles.center}>
          <Text style={styles.emptyText}>Visita não encontrada.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = STATUS_COLOR[visita.status] ?? COLORS.textLight;

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader title="Detalhes da Visita" showBack backTo={backTo ?? '/(app)/visitas'} />
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Cabeçalho */}
        <Card style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.dataText}>{formatDate(visita.data_visita)}</Text>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {STATUS_LABEL[visita.status] ?? visita.status}
              </Text>
            </View>
            {visita.motivo_visita && (
              <View style={styles.motivoBadge}>
                <Text style={styles.motivoBadgeText}>
                  {MOTIVOS_LABEL[visita.motivo_visita] ?? visita.motivo_visita}
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* Sinais vitais */}
        {(visita.pa_visita || visita.glicemia_visita || visita.peso_visita) && (
          <Section title="Sinais Vitais" icon="pulse-outline">
            <View style={styles.vitaisGrid}>
              {visita.pa_visita && (
                <VitalBox label="Pressão Arterial" value={visita.pa_visita} unit="mmHg" />
              )}
              {visita.glicemia_visita && (
                <VitalBox label="Glicemia" value={visita.glicemia_visita} unit="mg/dL" />
              )}
              {visita.peso_visita && (
                <VitalBox label="Peso" value={visita.peso_visita} unit="kg" />
              )}
            </View>
          </Section>
        )}

        {/* Acompanhamento */}
        {(visita.medicamentos_em_dia !== undefined || visita.cartao_vacinas_em_dia !== undefined) && (
          <Section title="Acompanhamento" icon="checkmark-circle-outline">
            {visita.medicamentos_em_dia !== undefined && (
              <InfoRow
                label="Medicamentos em dia"
                value={visita.medicamentos_em_dia ? 'Sim' : 'Não'}
                color={visita.medicamentos_em_dia ? COLORS.success : COLORS.error}
              />
            )}
            {visita.cartao_vacinas_em_dia !== undefined && (
              <InfoRow
                label="Cartão de vacinas em dia"
                value={visita.cartao_vacinas_em_dia ? 'Sim' : 'Não'}
                color={visita.cartao_vacinas_em_dia ? COLORS.success : COLORS.error}
              />
            )}
          </Section>
        )}

        {/* Queixas e observações */}
        {(visita.queixas || visita.observacoes) && (
          <Section title="Queixas e Observações" icon="chatbubble-outline">
            {visita.queixas && (
              <InfoBlock label="Queixas" value={visita.queixas} />
            )}
            {visita.observacoes && (
              <InfoBlock label="Observações" value={visita.observacoes} />
            )}
          </Section>
        )}

        {/* Encaminhamentos */}
        {visita.encaminhamentos && (
          <Section title="Encaminhamentos" icon="arrow-forward-circle-outline">
            <Text style={styles.blockText}>{visita.encaminhamentos}</Text>
          </Section>
        )}

        {/* Agendamento */}
        {visita.precisa_agendamento && (
          <Section title="Agendamento de Consulta" icon="calendar-outline">
            <View style={styles.agendamentoBox}>
              <Ionicons name="alert-circle" size={20} color={COLORS.warning} />
              <Text style={styles.agendamentoText}>
                Necessita agendamento
                {visita.especialidade_agendamento ? `: ${visita.especialidade_agendamento}` : ''}
              </Text>
            </View>
          </Section>
        )}

        {/* Rodapé */}
        <Text style={styles.footerText}>
          Registrada em {formatDateTime(visita.created_at)}
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <Card style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon as any} size={18} color={COLORS.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </Card>
  );
}

function VitalBox({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.vitalBox}>
      <Text style={styles.vitalValue}>{value}</Text>
      <Text style={styles.vitalUnit}>{unit}</Text>
      <Text style={styles.vitalLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, color ? { color } : undefined]}>{value}</Text>
    </View>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoBlockLabel}>{label}</Text>
      <Text style={styles.blockText}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: COLORS.textLight, fontSize: FONT_SIZE.md },
  scroll: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },

  headerCard: { gap: SPACING.xs },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  dataText: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text },
  statusText: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  motivoBadge: {
    backgroundColor: COLORS.primaryLight + '33',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  motivoBadgeText: { fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: '600' },

  section: { gap: SPACING.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: 2 },
  sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },

  vitaisGrid: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  vitalBox: {
    flex: 1, minWidth: 90, backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm, padding: SPACING.sm, alignItems: 'center',
  },
  vitalValue: { fontSize: FONT_SIZE.xxl, fontWeight: '800', color: COLORS.primary },
  vitalUnit: { fontSize: FONT_SIZE.xs, color: COLORS.textLight },
  vitalLabel: { fontSize: FONT_SIZE.xs, color: COLORS.text, fontWeight: '500', textAlign: 'center', marginTop: 2 },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.xs, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  infoLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textLight },
  infoValue: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text },

  infoBlock: { gap: 4 },
  infoBlockLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textLight, fontWeight: '600', textTransform: 'uppercase' },
  blockText: { fontSize: FONT_SIZE.md, color: COLORS.text, lineHeight: 22 },

  agendamentoBox: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  agendamentoText: { fontSize: FONT_SIZE.md, color: COLORS.text, fontWeight: '500', flex: 1 },

  footerText: { fontSize: FONT_SIZE.xs, color: COLORS.textLight, textAlign: 'center', marginTop: SPACING.sm },
});
