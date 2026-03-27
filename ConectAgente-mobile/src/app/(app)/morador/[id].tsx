import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Morador, Visita } from '../../../types';
import { moradorRepository } from '../../../database/repositories/moradorRepository';
import { visitaRepository } from '../../../database/repositories/visitaRepository';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { PageHeader } from '../../../components/ui/PageHeader';
import { calcularIdade, formatDate, toDateBR } from '../../../utils/formatters';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../../utils/constants';

export default function MoradorDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [morador, setMorador] = useState<Morador | null>(null);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function carregar() {
    if (!id) return;
    const [m, v] = await Promise.all([
      moradorRepository.buscarPorId(id),
      visitaRepository.buscarPorMorador(id),
    ]);
    setMorador(m);
    setVisitas(v);
    setIsLoading(false);
  }

  async function onRefresh() {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }

  useEffect(() => {
    carregar();
  }, [id]);

  if (isLoading) return <LoadingSpinner />;
  if (!morador) return <EmptyState title="Morador não encontrado" />;

  const idade = calcularIdade(morador.data_nascimento);

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader
        title={morador.nome}
        subtitle={`${idade} anos`}
        showBack
        backTo={`/(app)/residencia/${morador.residencia_id}`}
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scroll}
      >
        {/* IDENTIFICAÇÃO */}
        <Card>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{morador.nome.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.avatarInfo}>
              <Text style={styles.name}>{morador.nome}</Text>
              <Text style={styles.ageText}>
                {traduzirSexo(morador.sexo)} • {idade} anos
              </Text>
              <Text style={styles.dob}>Nasc.: {toDateBR(morador.data_nascimento)}</Text>
            </View>
          </View>

          <View style={styles.badgeRow}>
            {morador.tem_doenca && <Badge label="Doenças" variant="error" />}
            {morador.beneficio_bolsa_familia && <Badge label="Bolsa Família" variant="success" />}
            {morador.tem_convenio && <Badge label="Convênio" variant="info" />}
            {morador.toma_medicamento && <Badge label="Medicamentos" variant="warning" />}
            {morador.is_responsavel && <Badge label="Responsável" variant="info" />}
          </View>
        </Card>

        {/* CONTATO */}
        <Card>
          <Text style={styles.cardTitle}>Contato e documentos</Text>
          <InfoRow label="CPF" value={morador.cpf ?? 'Não informado'} />
          <InfoRow label="Cartão SUS" value={morador.cartao_sus ?? 'Não informado'} />
          <InfoRow label="Telefone" value={morador.telefone ?? 'Não informado'} />
          <InfoRow label="Cidade natal" value={morador.cidade_nascimento ?? 'Não informada'} />
          <InfoRow label="Mãe" value={morador.nome_mae ?? 'Não informada'} />
          <InfoRow label="Pai" value={morador.nome_pai ?? 'Não informado'} />
          <InfoRow label="Escolaridade" value={morador.escolaridade ?? 'Não informada'} />
          <InfoRow label="Profissão" value={morador.profissao ?? 'Não informada'} />
        </Card>

        {/* SAÚDE */}
        {(morador.tem_doenca || morador.toma_medicamento) && (
          <Card>
            <Text style={styles.cardTitle}>Saúde</Text>
            {morador.doencas && <InfoRow label="Doenças" value={morador.doencas} />}
            {morador.medicamentos_lista && <InfoRow label="Medicamentos" value={morador.medicamentos_lista} />}
            {morador.convenio_nome && <InfoRow label="Convênio" value={morador.convenio_nome} />}
          </Card>
        )}

        {/* AÇÕES */}
        <View style={styles.actions}>
          <ActionButton
            icon="document-text-outline"
            label="Abrir prontuário"
            color={COLORS.primary}
            onPress={() => router.push({
              pathname: '/(app)/prontuario/[moradorId]',
              params: { moradorId: id },
            })}
          />
          <ActionButton
            icon="clipboard-outline"
            label="Registrar visita"
            color={COLORS.info}
            onPress={() => router.push({
              pathname: '/(app)/visita/nova',
              params: { morador_id: id, residencia_id: morador.residencia_id },
            })}
          />
        </View>

        {/* HISTÓRICO DE VISITAS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Histórico de visitas ({visitas.length})</Text>
          {visitas.length === 0 ? (
            <EmptyState icon="clipboard-outline" title="Sem visitas registradas" />
          ) : (
            visitas.map((v) => (
              <Card key={v.id} style={styles.visitaCard}>
                <View style={styles.visitaRow}>
                  <View style={styles.visitaIcon}>
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                  </View>
                  <View style={styles.visitaInfo}>
                    <Text style={styles.visitaDate}>{formatDate(v.data_visita)}</Text>
                    {v.observacoes && (
                      <Text style={styles.visitaObs} numberOfLines={2}>{v.observacoes}</Text>
                    )}
                  </View>
                  <Badge
                    label={traduzirStatus(v.status)}
                    variant={v.status === 'realizada' ? 'success' : v.status === 'cancelada' ? 'error' : 'warning'}
                  />
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ActionButton({ icon, label, color, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, { borderColor: color }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function traduzirSexo(sexo: string): string {
  return { masculino: 'Masculino', feminino: 'Feminino', outro: 'Outro' }[sexo] ?? sexo;
}

function traduzirStatus(status: string): string {
  return { realizada: 'Realizada', agendada: 'Agendada', cancelada: 'Cancelada', nao_encontrado: 'Não encontrado' }[status] ?? status;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },
  avatarRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.sm },
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: FONT_SIZE.xxl, fontWeight: '800', color: COLORS.white },
  avatarInfo: { flex: 1, justifyContent: 'center' },
  name: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  ageText: { fontSize: FONT_SIZE.md, color: COLORS.textLight },
  dob: { fontSize: FONT_SIZE.sm, color: COLORS.placeholder },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cardTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  infoLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textLight, flex: 1 },
  infoValue: { fontSize: FONT_SIZE.sm, color: COLORS.text, flex: 2, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: SPACING.sm },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xs, padding: SPACING.sm, borderRadius: RADIUS.md,
    borderWidth: 1.5, backgroundColor: COLORS.white,
  },
  actionText: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  section: { gap: SPACING.sm },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  visitaCard: { padding: SPACING.sm },
  visitaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  visitaIcon: { width: 32, alignItems: 'center' },
  visitaInfo: { flex: 1 },
  visitaDate: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  visitaObs: { fontSize: FONT_SIZE.sm, color: COLORS.textLight },
});
