import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVisitas } from '../../../hooks/useVisitas';
import { FormField } from '../../../components/forms/FormField';
import { SelectField } from '../../../components/forms/SelectField';
import { SwitchField } from '../../../components/forms/SwitchField';
import { Button } from '../../../components/button';
import { PageHeader } from '../../../components/ui/PageHeader';
import { visitaSchema, VisitaFormDataValidated, validarDataBR } from '../../../utils/validators';
import { formatDateInput, parseDateBR } from '../../../utils/formatters';
import { ESPECIALIDADES, COLORS, SPACING, FONT_SIZE } from '../../../utils/constants';
import { StatusVisita } from '../../../types';
import { useResidencias } from '../../../hooks/useResidencias';
import { visitaRepository } from '../../../database/repositories/visitaRepository';

const MOTIVO_OPTIONS = [
  { label: 'Visita de rotina', value: 'rotina' },
  { label: 'Busca ativa', value: 'busca_ativa' },
  { label: 'Urgência / Sintomas', value: 'urgencia' },
  { label: 'Retorno de visita', value: 'retorno' },
  { label: 'Por solicitação do paciente', value: 'solicitacao' },
];

const STATUS_OPTIONS = [
  { label: 'Realizada', value: StatusVisita.REALIZADA },
  { label: 'Não encontrado', value: StatusVisita.NAO_ENCONTRADO },
  { label: 'Cancelada', value: StatusVisita.CANCELADA },
];

export default function NovaVisita() {
  const { residencia_id, morador_id, backTo } = useLocalSearchParams<{
    residencia_id?: string;
    morador_id?: string;
    backTo?: string;
  }>();
  const { registrarVisita, agendarVisita } = useVisitas();
  const { residencias } = useResidencias();
  const [isLoading, setIsLoading] = useState(false);
  const [modo, setModo] = useState<'realizar' | 'agendar'>('realizar');
  const [isPrimeiraVisita, setIsPrimeiraVisita] = useState(true);

  const defaultValues = {
    residencia_id: residencia_id ?? '',
    morador_id: morador_id ?? undefined,
    data_visita: new Date().toLocaleDateString('pt-BR'),
    status: StatusVisita.REALIZADA,
    motivo_visita: 'rotina' as const,
    precisa_agendamento: false,
    medicamentos_em_dia: false,
    cartao_vacinas_em_dia: false,
  };

  const { control, handleSubmit, watch, setValue, getValues, reset } = useForm<VisitaFormDataValidated>({
    resolver: zodResolver(visitaSchema),
    mode: 'onBlur',
    defaultValues,
  });

  const precisaAgendamento = watch('precisa_agendamento');
  const statusAtual = watch('status');
  const visitaRealizada = statusAtual === StatusVisita.REALIZADA;

  // Zera o formulário e pré-preenche apenas campos contextuais a cada abertura
  useFocusEffect(
    useCallback(() => {
      reset({
        ...defaultValues,
        residencia_id: residencia_id ?? '',
        morador_id: morador_id ?? undefined,
        data_visita: new Date().toLocaleDateString('pt-BR'),
      });
      setModo('realizar');
      setIsPrimeiraVisita(true);

      if (!residencia_id) return;
      visitaRepository.buscarUltimaVisitaPorResidencia(residencia_id).then((ultima) => {
        if (!ultima) return;
        setIsPrimeiraVisita(false);
        // Pré-preenche apenas campos contextuais (NÃO sinais vitais, queixas, observações)
        if (ultima.morador_id && !morador_id) setValue('morador_id', ultima.morador_id);
        const motivosValidos = ['rotina', 'busca_ativa', 'urgencia', 'retorno', 'solicitacao'] as const;
        if (ultima.motivo_visita && motivosValidos.includes(ultima.motivo_visita as any)) {
          setValue('motivo_visita', ultima.motivo_visita as typeof motivosValidos[number]);
        }
        if (ultima.medicamentos_em_dia != null) setValue('medicamentos_em_dia', ultima.medicamentos_em_dia);
        if (ultima.cartao_vacinas_em_dia != null) setValue('cartao_vacinas_em_dia', ultima.cartao_vacinas_em_dia);
      });
    }, [residencia_id, morador_id])
  );

  const residenciaOptions = residencias.map((r) => ({
    label: `${r.logradouro}, ${r.numero} - ${r.bairro}`,
    value: r.id,
  }));

  async function onSubmitVisita(data: VisitaFormDataValidated) {
    setIsLoading(true);
    try {
      await registrarVisita({
        residencia_id: data.residencia_id,
        morador_id: data.morador_id,
        data_visita: parseDateBR(data.data_visita),
        status: data.status as StatusVisita,
        motivo_visita: data.motivo_visita,
        queixas: data.queixas,
        observacoes: data.observacoes,
        pa_visita: data.pa_visita,
        glicemia_visita: data.glicemia_visita,
        peso_visita: data.peso_visita,
        medicamentos_em_dia: data.medicamentos_em_dia,
        cartao_vacinas_em_dia: data.cartao_vacinas_em_dia,
        encaminhamentos: data.encaminhamentos,
        precisa_agendamento: data.precisa_agendamento,
        especialidade_agendamento: data.especialidade_agendamento,
      });
      router.replace(
        residencia_id
          ? { pathname: '/(app)/residencia/[id]', params: { id: residencia_id } }
          : '/(app)/visitas'
      );
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Erro ao salvar');
    } finally {
      setIsLoading(false);
    }
  }

  async function onSubmitAgendamento(data: VisitaFormDataValidated) {
    setIsLoading(true);
    try {
      await agendarVisita({
        residencia_id: data.residencia_id,
        morador_id: data.morador_id,
        data_agendada: parseDateBR(data.data_visita),
        motivo: data.observacoes ?? 'Visita de rotina',
        observacoes: data.observacoes,
      });
      router.replace('/(app)/calendario');
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Erro ao agendar');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader
        title={modo === 'realizar' ? 'Registrar Visita' : 'Agendar Visita'}
        showBack
        backTo={backTo ?? (residencia_id ? `/(app)/residencia/${residencia_id}` : undefined)}
      />

      {/* MODO */}
      <View style={styles.modoContainer}>
        <View style={styles.modoBtn}>
          <Button
            title="Realizar agora"
            variant={modo === 'realizar' ? 'primary' : 'ghost'}
            onPress={() => setModo('realizar')}
          />
        </View>
        <View style={styles.modoBtn}>
          <Button
            title="Agendar"
            variant={modo === 'agendar' ? 'primary' : 'ghost'}
            onPress={() => setModo('agendar')}
          />
        </View>
      </View>

      {!isPrimeiraVisita && modo === 'realizar' && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Motivo e acompanhamento pré-preenchidos da última visita. Sinais vitais e queixas em branco para nova coleta.
          </Text>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* IDENTIFICAÇÃO */}
          <SectionTitle title="Identificação" />

          {!residencia_id && (
            <SelectField
              control={control} name="residencia_id" label="Residência" required
              options={residenciaOptions}
              placeholder="Selecione a residência..."
            />
          )}

          <FormField
            control={control} name="data_visita"
            label={modo === 'realizar' ? 'Data da visita' : 'Data do agendamento'}
            placeholder="DD/MM/AAAA" keyboardType="numeric" mask={formatDateInput} required
            onBlur={() => {
              const val = getValues('data_visita');
              if (val && !validarDataBR(val)) setValue('data_visita', '');
            }}
          />

          {modo === 'realizar' && (
            <>
              <SelectField
                control={control} name="status" label="Status da visita" required
                options={STATUS_OPTIONS}
              />

              <SelectField
                control={control} name="motivo_visita" label="Motivo da visita"
                options={MOTIVO_OPTIONS}
                placeholder="Selecione o motivo..."
              />

              {visitaRealizada && (
                <>
                  {/* SINAIS VITAIS */}
                  <SectionTitle title="Sinais Vitais" />

                  <FormField
                    control={control} name="pa_visita"
                    label="Pressão arterial (PA)"
                    placeholder="Ex: 120/80 mmHg"
                    keyboardType="default"
                  />

                  <FormField
                    control={control} name="glicemia_visita"
                    label="Glicemia capilar (HGT)"
                    placeholder="Ex: 98 mg/dL"
                    keyboardType="numeric"
                  />

                  <FormField
                    control={control} name="peso_visita"
                    label="Peso / Altura"
                    placeholder="Ex: 70 kg / 1,70 m"
                    keyboardType="default"
                  />

                  {/* QUEIXAS E OBSERVAÇÕES */}
                  <SectionTitle title="Queixas e Observações" />

                  <FormField
                    control={control} name="queixas"
                    label="Queixas relatadas pelo paciente"
                    placeholder="Descreva os sintomas e queixas..."
                    multiline numberOfLines={3}
                  />

                  <FormField
                    control={control} name="observacoes"
                    label="Observações do agente"
                    placeholder="O que foi observado durante a visita..."
                    multiline numberOfLines={3}
                  />

                  {/* CONDIÇÕES E ACOMPANHAMENTO */}
                  <SectionTitle title="Acompanhamento" />

                  <SwitchField
                    control={control} name="medicamentos_em_dia"
                    label="Medicamentos em dia"
                    description="Paciente está tomando os medicamentos regularmente"
                  />

                  <SwitchField
                    control={control} name="cartao_vacinas_em_dia"
                    label="Cartão de vacinas em dia"
                    description="Cartão de vacinação atualizado"
                  />

                  <FormField
                    control={control} name="encaminhamentos"
                    label="Encaminhamentos realizados"
                    placeholder="Ex: UBS, especialista, CAPS..."
                    multiline numberOfLines={2}
                  />

                  {/* AGENDAMENTO */}
                  <SectionTitle title="Agendamento de Consulta" />

                  <SwitchField
                    control={control} name="precisa_agendamento"
                    label="Precisa de agendamento?"
                    description="Agendar consulta em especialidade médica"
                  />

                  {precisaAgendamento && (
                    <SelectField
                      control={control} name="especialidade_agendamento" label="Especialidade"
                      options={ESPECIALIDADES.map((e) => ({ label: e, value: e }))}
                      placeholder="Selecione a especialidade..."
                    />
                  )}
                </>
              )}

              <Button
                title="Registrar visita"
                onPress={handleSubmit(onSubmitVisita, (erros) => {
                  const msgs = Object.entries(erros).map(([campo, e]) => `• ${e?.message}`).filter(Boolean);
                  Alert.alert('Corrija os campos', msgs.length ? msgs.join('\n') : 'Verifique os campos obrigatórios');
                })}
                loading={isLoading}
              />
            </>
          )}

          {modo === 'agendar' && (
            <>
              <FormField
                control={control} name="observacoes"
                label="Motivo do agendamento"
                placeholder="Por que deseja retornar?"
                multiline numberOfLines={3} required
              />
              <Button
                title="Confirmar agendamento"
                onPress={handleSubmit(onSubmitAgendamento, (erros) => {
                  const msgs = Object.entries(erros).map(([_, e]) => `• ${e?.message}`).filter(Boolean);
                  Alert.alert('Corrija os campos', msgs.length ? msgs.join('\n') : 'Verifique os campos obrigatórios');
                })}
                loading={isLoading}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.sectionTitleContainer}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  modoContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modoBtn: { flex: 1 },
  infoBanner: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE',
  },
  infoBannerText: {
    fontSize: FONT_SIZE.xs,
    color: '#1D4ED8',
  },
  scroll: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.borderLight,
  },
});
