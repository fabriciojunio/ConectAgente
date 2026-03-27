import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, FlatList,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Residencia, Morador, Visita, StatusVisita } from '../../../types';
import { residenciaRepository } from '../../../database/repositories/residenciaRepository';
import { visitaRepository } from '../../../database/repositories/visitaRepository';
import { useMoradores } from '../../../hooks/useMoradores';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { PageHeader } from '../../../components/ui/PageHeader';
import { calcularIdade, formatDate, toDateBR } from '../../../utils/formatters';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../../utils/constants';

const MOTIVOS_LABEL: Record<string, string> = {
  rotina: 'Rotina', busca_ativa: 'Busca ativa',
  urgencia: 'Urgência', retorno: 'Retorno', solicitacao: 'Por solicitação',
};

export default function ResidenciaDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [residencia, setResidencia] = useState<Residencia | null>(null);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { moradores, carregar: carregarMoradores } = useMoradores(id);

  async function carregarResidencia() {
    if (!id) return;
    const r = await residenciaRepository.buscarPorId(id);
    setResidencia(r);
  }

  async function carregar() {
    setIsLoading(true);
    await Promise.all([
      carregarResidencia(),
      carregarMoradores(id),
      visitaRepository.listarPorResidencia(id).then(setVisitas),
    ]);
    setIsLoading(false);
  }

  async function onRefresh() {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [id])
  );

  if (isLoading) return <LoadingSpinner message="Carregando..." />;
  if (!residencia) return <EmptyState title="Residência não encontrada" />;

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader
        title="Residência"
        subtitle={`${residencia.logradouro}, ${residencia.numero}`}
        showBack
        backTo="/(app)/residencias"
        rightAction={{
          icon: 'person-add-outline',
          onPress: () => router.push({
            pathname: '/(app)/morador/novo',
            params: { residencia_id: id },
          }),
        }}
      />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scroll}
      >
        {/* ENDEREÇO */}
        <Card>
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={20} color={COLORS.primary} />
            <View style={styles.addressInfo}>
              <Text style={styles.addressMain}>
                {residencia.logradouro}, {residencia.numero}
                {residencia.complemento ? ` - ${residencia.complemento}` : ''}
              </Text>
              <Text style={styles.addressSub}>
                {residencia.bairro} • {residencia.cidade}/{residencia.estado}
              </Text>
              <Text style={styles.addressCep}>CEP: {residencia.cep}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoGrid}>
            <InfoItem label="Tipo" value={traduzirTipo(residencia.tipo_imovel)} />
            <InfoItem label="Cômodos" value={String(residencia.num_comodos)} />
            <InfoItem label="Animais" value={residencia.tem_animais ? 'Sim' : 'Não'} />
            {residencia.animais_info && (
              <InfoItem label="Quais" value={residencia.animais_info} />
            )}
          </View>
        </Card>

        {/* MORADORES */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Moradores ({moradores.length})</Text>
            <TouchableOpacity
              onPress={() => router.push({
                pathname: '/(app)/morador/novo',
                params: { residencia_id: id },
              })}
              style={styles.addButton}
            >
              <Ionicons name="add" size={18} color={COLORS.white} />
              <Text style={styles.addButtonText}>Adicionar</Text>
            </TouchableOpacity>
          </View>

          {moradores.length === 0 ? (
            <EmptyState
              icon="person-outline"
              title="Nenhum morador"
              description="Adicione os moradores desta residência"
            />
          ) : (
            moradores.map((morador) => (
              <MoradorCard
                key={morador.id}
                morador={morador}
                isResponsavel={morador.id === residencia.morador_responsavel_id}
                onPress={() => router.push({
                  pathname: '/(app)/morador/[id]',
                  params: { id: morador.id },
                })}
              />
            ))
          )}
        </View>

        {/* HISTÓRICO DE VISITAS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Histórico de visitas ({visitas.length})</Text>
          </View>

          {visitas.length === 0 ? (
            <EmptyState
              icon="clipboard-outline"
              title="Nenhuma visita registrada"
              description="Registre a primeira visita nesta residência"
            />
          ) : (
            visitas.map((v) => <VisitaHistoricoCard key={v.id} visita={v} />)
          )}
        </View>

        {/* AÇÕES */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push({
              pathname: '/(app)/visita/nova',
              params: { residencia_id: id },
            })}
          >
            <Ionicons name="clipboard-outline" size={20} color={COLORS.primary} />
            <Text style={styles.actionText}>Registrar visita</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MoradorCard({ morador, isResponsavel, onPress }: {
  morador: Morador;
  isResponsavel: boolean;
  onPress: () => void;
}) {
  const idade = calcularIdade(morador.data_nascimento);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Card style={styles.moradorCard}>
        <View style={styles.moradorHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {morador.nome.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.moradorInfo}>
            <View style={styles.moradorNameRow}>
              <Text style={styles.moradorName} numberOfLines={1}>{morador.nome}</Text>
              {isResponsavel && <Badge label="Responsável" variant="info" />}
            </View>
            <Text style={styles.moradorDetails}>
              {traduzirSexo(morador.sexo)} • {idade} anos
            </Text>
            <View style={styles.badges}>
              {morador.tem_doenca && morador.doencas?.includes('hipertensão') && (
                <Badge label="HAS" variant="hipertenso" />
              )}
              {morador.tem_doenca && morador.doencas?.includes('diabetes') && (
                <Badge label="DM" variant="diabetico" />
              )}
              {morador.beneficio_bolsa_familia && (
                <Badge label="Bolsa Família" variant="success" />
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function VisitaHistoricoCard({ visita }: { visita: Visita }) {
  const statusConfig: Record<string, { color: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
    realizada: { color: COLORS.success, icon: 'checkmark-circle', label: 'Realizada' },
    nao_encontrado: { color: COLORS.warning, icon: 'alert-circle', label: 'Não encontrado' },
    cancelada: { color: COLORS.error, icon: 'close-circle', label: 'Cancelada' },
    agendada: { color: COLORS.info, icon: 'time', label: 'Agendada' },
  };
  const cfg = statusConfig[visita.status] ?? statusConfig.realizada;
  const motivo = visita.motivo_visita ? MOTIVOS_LABEL[visita.motivo_visita] ?? visita.motivo_visita : null;

  return (
    <View style={styles.visitaCard}>
      {/* Linha de cabeçalho */}
      <View style={styles.visitaHeader}>
        <Ionicons name={cfg.icon} size={18} color={cfg.color} />
        <Text style={styles.visitaData}>{formatDate(visita.data_visita)}</Text>
        <View style={[styles.visitaBadge, { backgroundColor: cfg.color + '18' }]}>
          <Text style={[styles.visitaBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* Detalhes */}
      {motivo && (
        <View style={styles.visitaDetalhe}>
          <Text style={styles.visitaDetalheLabel}>Motivo:</Text>
          <Text style={styles.visitaDetalheVal}>{motivo}</Text>
        </View>
      )}
      {visita.pa_visita && (
        <View style={styles.visitaDetalhe}>
          <Text style={styles.visitaDetalheLabel}>PA:</Text>
          <Text style={styles.visitaDetalheVal}>{visita.pa_visita}</Text>
        </View>
      )}
      {visita.glicemia_visita && (
        <View style={styles.visitaDetalhe}>
          <Text style={styles.visitaDetalheLabel}>HGT:</Text>
          <Text style={styles.visitaDetalheVal}>{visita.glicemia_visita}</Text>
        </View>
      )}
      {visita.peso_visita && (
        <View style={styles.visitaDetalhe}>
          <Text style={styles.visitaDetalheLabel}>Peso/Altura:</Text>
          <Text style={styles.visitaDetalheVal}>{visita.peso_visita}</Text>
        </View>
      )}
      {visita.queixas ? (
        <View style={styles.visitaDetalhe}>
          <Text style={styles.visitaDetalheLabel}>Queixas:</Text>
          <Text style={[styles.visitaDetalheVal, { flex: 1 }]} numberOfLines={2}>{visita.queixas}</Text>
        </View>
      ) : null}
      {visita.observacoes ? (
        <View style={styles.visitaDetalhe}>
          <Text style={styles.visitaDetalheLabel}>Observações:</Text>
          <Text style={[styles.visitaDetalheVal, { flex: 1 }]} numberOfLines={2}>{visita.observacoes}</Text>
        </View>
      ) : null}
      {visita.encaminhamentos ? (
        <View style={styles.visitaDetalhe}>
          <Text style={styles.visitaDetalheLabel}>Encaminhamentos:</Text>
          <Text style={[styles.visitaDetalheVal, { flex: 1 }]} numberOfLines={2}>{visita.encaminhamentos}</Text>
        </View>
      ) : null}
      {visita.precisa_agendamento && visita.especialidade_agendamento && (
        <View style={[styles.visitaDetalhe, styles.agendamentoTag]}>
          <Ionicons name="calendar-outline" size={13} color={COLORS.warning} />
          <Text style={[styles.visitaDetalheVal, { color: COLORS.warning }]}>
            Agendamento: {visita.especialidade_agendamento}
          </Text>
        </View>
      )}
    </View>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function traduzirTipo(tipo: string): string {
  const map: Record<string, string> = {
    proprio: 'Própria', alugado: 'Alugada', cedido: 'Cedida', outros: 'Outros',
  };
  return map[tipo] ?? tipo;
}

function traduzirSexo(sexo: string): string {
  const map: Record<string, string> = {
    masculino: 'Masculino', feminino: 'Feminino', outro: 'Outro',
  };
  return map[sexo] ?? sexo;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },
  addressRow: { flexDirection: 'row', gap: SPACING.sm },
  addressInfo: { flex: 1 },
  addressMain: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  addressSub: { fontSize: FONT_SIZE.sm, color: COLORS.textLight },
  addressCep: { fontSize: FONT_SIZE.xs, color: COLORS.placeholder },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACING.sm },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  infoItem: { minWidth: '40%' },
  infoLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textLight, fontWeight: '600' },
  infoValue: { fontSize: FONT_SIZE.md, color: COLORS.text },
  section: { gap: SPACING.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  addButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm, paddingVertical: 6,
  },
  addButtonText: { color: COLORS.white, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  moradorCard: { gap: SPACING.xs },
  moradorHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.white },
  moradorInfo: { flex: 1 },
  moradorNameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flexWrap: 'wrap' },
  moradorName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  moradorDetails: { fontSize: FONT_SIZE.sm, color: COLORS.textLight },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  visitaCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.sm + 2,
    marginBottom: SPACING.xs,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  visitaHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  visitaData: { flex: 1, fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  visitaBadge: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  visitaBadgeText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  visitaDetalhe: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  visitaDetalheLabel: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: COLORS.textLight, minWidth: 80 },
  visitaDetalheVal: { fontSize: FONT_SIZE.xs, color: COLORS.text },
  agendamentoTag: {
    backgroundColor: COLORS.warning + '12',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  actions: { gap: SPACING.sm },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1.5, borderColor: COLORS.primary,
  },
  actionText: { fontSize: FONT_SIZE.md, color: COLORS.primary, fontWeight: '600' },
});
