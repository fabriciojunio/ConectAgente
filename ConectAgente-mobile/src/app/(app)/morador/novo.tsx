import React, { useState, useEffect } from 'react';
import {
  View, Text, Switch, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMoradores } from '../../../hooks/useMoradores';
import { useResidencias } from '../../../hooks/useResidencias';
import { FormField } from '../../../components/forms/FormField';
import { SelectField } from '../../../components/forms/SelectField';
import { SwitchField } from '../../../components/forms/SwitchField';
import { Button } from '../../../components/button';
import { PageHeader } from '../../../components/ui/PageHeader';
import { moradorSchema, MoradorFormDataValidated, validarDataNascimento } from '../../../utils/validators';
import { formatCPF, stripCPF, formatCartaoSUS, formatTelefone, formatDateInput, parseDateBR } from '../../../utils/formatters';
import { SEXO_OPTIONS, ESCOLARIDADE_OPTIONS, COLORS, SPACING, FONT_SIZE } from '../../../utils/constants';
import { Sexo, Escolaridade } from '../../../types';
import { residenciaRepository } from '../../../database/repositories/residenciaRepository';
import { Controller } from 'react-hook-form';

export default function NovoMorador() {
  const { residencia_id: residenciaParam } = useLocalSearchParams<{ residencia_id: string }>();
  const { criar } = useMoradores(residenciaParam);
  const { residencias } = useResidencias();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'pessoal' | 'saude'>('pessoal');
  const [temResponsavel, setTemResponsavel] = useState(false);

  useEffect(() => {
    if (!residenciaParam) return;
    residenciaRepository.buscarPorId(residenciaParam).then((r) => {
      setTemResponsavel(!!r?.morador_responsavel_id);
    });
  }, [residenciaParam]);

  const residenciaOptions = residencias.map((r) => ({
    label: `${r.logradouro}, ${r.numero} — ${r.bairro}`,
    value: r.id,
  }));

  const { control, handleSubmit, watch, trigger, setValue, getValues } = useForm<MoradorFormDataValidated>({
    resolver: zodResolver(moradorSchema),
    mode: 'onBlur',
    defaultValues: {
      residencia_id: residenciaParam ?? '',
      tem_doenca: false,
      beneficio_bolsa_familia: false,
      tem_convenio: false,
      toma_medicamento: false,
      is_responsavel: false,
      sexo: 'masculino',
    },
  });

  const temDoenca = watch('tem_doenca');
  const temConvenio = watch('tem_convenio');
  const tomaMedicamento = watch('toma_medicamento');

  async function onSubmit(data: MoradorFormDataValidated) {
    setIsLoading(true);
    try {
      const morador = await criar({
        ...data,
        cpf: data.cpf ? stripCPF(data.cpf) : undefined,
        data_nascimento: parseDateBR(data.data_nascimento),
        residencia_id: data.residencia_id,
        sexo: data.sexo as Sexo,
        escolaridade: data.escolaridade as Escolaridade | undefined,
      });
      router.replace({
        pathname: '/(app)/prontuario/[moradorId]',
        params: { moradorId: morador.id },
      });
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Erro ao cadastrar');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader
        title="Novo Morador"
        showBack
        backTo={residenciaParam ? `/(app)/residencia/${residenciaParam}` : undefined}
      />

      {/* STEPPER */}
      <View style={styles.stepper}>
        <StepIndicator active={step === 'pessoal'} label="Dados pessoais" number={1} />
        <View style={styles.stepLine} />
        <StepIndicator active={step === 'saude'} label="Saúde e social" number={2} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {step === 'pessoal' ? (
            <View style={styles.form}>
              {!residenciaParam && (
                <>
                  <Text style={styles.sectionTitle}>Residência</Text>
                  <SelectField
                    control={control}
                    name="residencia_id"
                    label="Residência"
                    options={residenciaOptions}
                    required
                  />
                </>
              )}
              <Text style={styles.sectionTitle}>Identificação</Text>
              <FormField control={control} name="nome" label="Nome completo" placeholder="Nome do morador" required />
              <FormField control={control} name="data_nascimento" label="Data de nascimento" placeholder="DD/MM/AAAA" keyboardType="numeric" mask={formatDateInput} required
                onBlur={() => {
                  const val = getValues('data_nascimento');
                  if (val && !validarDataNascimento(val)) setValue('data_nascimento', '');
                }}
              />
              <SelectField control={control} name="sexo" label="Sexo" options={SEXO_OPTIONS} required />
              <FormField control={control} name="cpf" label="CPF" placeholder="000.000.000-00" keyboardType="numeric" mask={formatCPF} />
              <FormField control={control} name="cartao_sus" label="Cartão SUS" placeholder="000 0000 0000 0000" keyboardType="numeric" mask={formatCartaoSUS} />
              <FormField control={control} name="telefone" label="Telefone" placeholder="(00) 00000-0000" keyboardType="phone-pad" mask={formatTelefone} />

              <Text style={styles.sectionTitle}>Filiação e naturalidade</Text>
              <FormField control={control} name="nome_mae" label="Nome da mãe" placeholder="Nome completo da mãe" />
              <FormField control={control} name="nome_pai" label="Nome do pai" placeholder="Nome completo do pai" />
              <FormField control={control} name="cidade_nascimento" label="Cidade de nascimento" placeholder="Cidade/UF" />

              <Text style={styles.sectionTitle}>Perfil</Text>
              <SelectField control={control} name="escolaridade" label="Escolaridade" options={ESCOLARIDADE_OPTIONS} />
              <FormField control={control} name="profissao" label="Profissão" placeholder="Profissão ou ocupação" />

              <Controller
                control={control}
                name="is_responsavel"
                render={({ field: { value, onChange } }) => (
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>É responsável pela residência?</Text>
                    <Switch
                      value={Boolean(value)}
                      onValueChange={(novo) => {
                        if (novo && temResponsavel) {
                          Alert.alert(
                            'Já existe um responsável',
                            'Esta residência já possui um responsável cadastrado. Deseja substituí-lo por este morador?',
                            [
                              { text: 'Cancelar', style: 'cancel' },
                              { text: 'Substituir', style: 'destructive', onPress: () => onChange(true) },
                            ]
                          );
                        } else {
                          onChange(novo);
                        }
                      }}
                      trackColor={{ false: COLORS.disabled, true: COLORS.primaryLight }}
                      thumbColor={value ? COLORS.primary : COLORS.white}
                    />
                  </View>
                )}
              />
              <SwitchField control={control} name="beneficio_bolsa_familia" label="Beneficiário do Bolsa Família?" />

              <Button
                title="Próximo: Saúde e social"
                onPress={async () => {
                  const fields: (keyof MoradorFormDataValidated)[] = ['nome', 'data_nascimento', 'sexo'];
                  if (!residenciaParam) fields.push('residencia_id');
                  const valid = await trigger(fields);
                  if (valid) {
                    setStep('saude');
                  } else {
                    // errors may be stale in closure — re-read via trigger's side effects on formState
                    const vals = getValues();
                    const msgs: string[] = [];
                    if (!vals.nome) msgs.push('• Nome: obrigatório');
                    if (!vals.data_nascimento || !validarDataNascimento(vals.data_nascimento)) msgs.push('• Data de nascimento: inválida ou futura');
                    if (!vals.sexo) msgs.push('• Sexo: obrigatório');
                    if (!residenciaParam && !vals.residencia_id) msgs.push('• Residência: obrigatória');
                    Alert.alert('Corrija os campos', msgs.length ? msgs.join('\n') : 'Verifique os campos obrigatórios');
                  }
                }}
              />
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.sectionTitle}>Saúde</Text>
              <SwitchField control={control} name="tem_doenca" label="Possui alguma doença?" />
              {temDoenca && (
                <FormField
                  control={control} name="doencas" label="Quais doenças?"
                  placeholder="Ex: Hipertensão, Diabetes..." multiline numberOfLines={3}
                />
              )}

              <SwitchField control={control} name="toma_medicamento" label="Faz uso de medicamentos?" />
              {tomaMedicamento && (
                <FormField
                  control={control} name="medicamentos_lista" label="Quais medicamentos?"
                  placeholder="Liste os medicamentos e dosagens..." multiline numberOfLines={3}
                />
              )}

              <SwitchField control={control} name="tem_convenio" label="Possui plano de saúde?" />
              {temConvenio && (
                <FormField control={control} name="convenio_nome" label="Qual plano?" placeholder="Nome do convênio/plano" />
              )}

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Button title="Voltar" variant="ghost" onPress={() => setStep('pessoal')} />
                </View>
                <View style={{ flex: 2 }}>
                  <Button
                    title="Cadastrar morador"
                    onPress={handleSubmit(onSubmit, (errors) => {
                      const msgs = Object.values(errors).map((e) => e?.message).filter(Boolean);
                      Alert.alert('Corrija os erros', msgs.length ? msgs.join('\n') : 'Verifique os campos obrigatórios');
                    })}
                    loading={isLoading}
                  />
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StepIndicator({ number, label, active }: { number: number; label: string; active: boolean }) {
  return (
    <View style={styles.stepItem}>
      <View style={[styles.stepCircle, active && styles.stepCircleActive]}>
        <Text style={[styles.stepNumber, active && styles.stepNumberActive]}>{number}</Text>
      </View>
      <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  stepper: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.md,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  stepItem: { alignItems: 'center', gap: 4, flex: 1 },
  stepCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.borderLight, alignItems: 'center', justifyContent: 'center',
  },
  stepCircleActive: { backgroundColor: COLORS.primary },
  stepNumber: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.textLight },
  stepNumberActive: { color: COLORS.white },
  stepLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textLight },
  stepLabelActive: { color: COLORS.primary, fontWeight: '600' },
  stepLine: { flex: 1, height: 2, backgroundColor: COLORS.borderLight },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl },
  form: { gap: SPACING.md },
  sectionTitle: {
    fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.primary, marginTop: SPACING.sm,
  },
  row: { flexDirection: 'row', gap: SPACING.sm },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  switchLabel: { fontSize: FONT_SIZE.md, fontWeight: '500', color: COLORS.text, flex: 1, marginRight: SPACING.md },
});
