import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useForm } from 'react-hook-form';
import { Morador, Prontuario } from '../../../types';
import { moradorRepository } from '../../../database/repositories/moradorRepository';
import { prontuarioRepository } from '../../../database/repositories/prontuarioRepository';
import { useAuth } from '../../../contexts/AuthContext';
import { FormField } from '../../../components/forms/FormField';
import { SwitchField } from '../../../components/forms/SwitchField';
import { SelectField } from '../../../components/forms/SelectField';
import { Button } from '../../../components/button';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Badge } from '../../../components/ui/Badge';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { calcularIdade, formatDateInput } from '../../../utils/formatters';
import { validarDataBR } from '../../../utils/validators';
import { COLORS, SPACING, FONT_SIZE, RADIUS, ESPECIALIDADES } from '../../../utils/constants';

type Step = 'saude' | 'gestante' | 'puericultura' | 'mulher' | 'social' | 'medicamentos';

const STEPS: { key: Step; label: string; icon: string }[] = [
  { key: 'saude', label: 'Saúde Geral', icon: 'heart-outline' },
  { key: 'gestante', label: 'Gestante', icon: 'body-outline' },
  { key: 'puericultura', label: 'Puericultura', icon: 'happy-outline' },
  { key: 'mulher', label: 'Saúde da Mulher', icon: 'woman-outline' },
  { key: 'social', label: 'Social', icon: 'people-outline' },
  { key: 'medicamentos', label: 'Medicamentos', icon: 'medkit-outline' },
];

export default function ProntuarioScreen() {
  const { moradorId } = useLocalSearchParams<{ moradorId: string }>();
  const { agente } = useAuth();
  const [morador, setMorador] = useState<Morador | null>(null);
  const [prontuario, setProntuario] = useState<Prontuario | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('saude');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { control: saudeControl, handleSubmit: handleSaude, setValue: setSaudeValue, getValues: getSaudeValues, watch: saudeWatch } = useForm({
    defaultValues: {
      is_hipertenso: false, is_diabetico: false, is_domiciliado: false,
      is_tuberculose: false, is_hanseniase: false,
      hgt_ultima_aferição: '', hgt_valor: '',
      pa_ultima_aferição: '', pa_valor: '',
      tem_receita_atualizada: false, ultima_consulta: '', proxima_consulta: '',
      precisa_agendamento: false, especialidade_agendamento: '', queixas: '', observacoes: '',
    },
  });

  const { control: gestanteControl, handleSubmit: handleGestante, setValue: setGestanteValue, getValues: getGestanteValues, watch: gestanteWatch } = useForm({
    defaultValues: {
      is_gestante: false, data_dum: '', semanas_gestacao: '',
      pre_natal_em_dia: false, local_pre_natal: '', proxima_consulta_pre_natal: '',
      vacina_tetano_em_dia: false, vacina_hepatiteb_em_dia: false,
      sulfato_ferroso: false, acido_folico: false, observacoes: '',
    },
  });

  const { control: puericulturaControl, handleSubmit: handlePuericultura, setValue: setPuericulturaValue, getValues: getPuericulturaValues, watch: puericulturaWatch } = useForm({
    defaultValues: {
      is_crianca: false, peso_atual: '', altura_atual: '',
      cartao_vacina_em_dia: false, vacinas_em_atraso: '',
      consulta_acompanhamento_em_dia: false, proxima_consulta: '',
      frequenta_escola: false, nome_escola: '', observacoes: '',
    },
  });

  const { control: mulherControl, handleSubmit: handleMulher, setValue: setMulherValue, getValues: getMulherValues, watch: mulherWatch } = useForm({
    defaultValues: {
      ultima_menstruacao: '', papanicolau_em_dia: false, data_ultimo_papanicolau: '',
      mamografia_em_dia: false, data_ultima_mamografia: '',
      usa_anticoncepcional: false, tipo_anticoncepcional: '',
      consulta_ginecologica_em_dia: false, prevencao_dts: false, observacoes: '',
    },
  });

  const { control: socialControl, handleSubmit: handleSocial, setValue: setSocialValue, getValues: getSocialValues, watch: socialWatch } = useForm({
    defaultValues: {
      vulnerabilidade_social: 'nenhum', descricao_vulnerabilidade: '',
      negligencia_parental: false, descricao_negligencia: '',
      violencia_domestica: false, descricao_violencia: '',
      depressao_suspeita: false, uso_alcool_drogas: false, descricao_uso: '',
      encaminhado_assistente_social: false, data_encaminhamento: '', observacoes: '',
    },
  });

  // Watch para campos condicionais
  const precisaAgendamento = saudeWatch('precisa_agendamento');
  const isGestante = gestanteWatch('is_gestante');
  const cartaoVacinaEmDia = puericulturaWatch('cartao_vacina_em_dia');
  const frequentaEscola = puericulturaWatch('frequenta_escola');
  const usaAnticoncepcional = mulherWatch('usa_anticoncepcional');
  const papanicolauEmDia = mulherWatch('papanicolau_em_dia');
  const mamografiaEmDia = mulherWatch('mamografia_em_dia');
  const negligencia = socialWatch('negligencia_parental');
  const violencia = socialWatch('violencia_domestica');
  const usoAlcool = socialWatch('uso_alcool_drogas');
  const encaminhadoAS = socialWatch('encaminhado_assistente_social');

  async function carregar() {
    if (!moradorId || !agente) return;
    setIsLoading(true);
    try {
      const [m, p] = await Promise.all([
        moradorRepository.buscarPorId(moradorId),
        prontuarioRepository.obterOuCriar(moradorId, agente.id),
      ]);
      setMorador(m);
      setProntuario(p);

      if (p.saude) {
        const s = p.saude;
        setSaudeValue('is_hipertenso', s.is_hipertenso);
        setSaudeValue('is_diabetico', s.is_diabetico);
        setSaudeValue('is_domiciliado', s.is_domiciliado);
        setSaudeValue('is_tuberculose', s.is_tuberculose);
        setSaudeValue('is_hanseniase', s.is_hanseniase);
        setSaudeValue('tem_receita_atualizada', s.tem_receita_atualizada);
        setSaudeValue('precisa_agendamento', s.precisa_agendamento);
        if (s.queixas) setSaudeValue('queixas', s.queixas);
        if (s.observacoes) setSaudeValue('observacoes', s.observacoes);
        if (s.especialidade_agendamento) setSaudeValue('especialidade_agendamento', s.especialidade_agendamento);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar o prontuário.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [moradorId, agente]);

  const stepsVisiveis = STEPS.filter((s) => {
    if (!morador) return false;
    const idade = calcularIdade(morador.data_nascimento);
    const isFeminino = morador.sexo === 'feminino';
    if (s.key === 'puericultura' && idade > 2) return false;
    if (s.key === 'mulher' && !isFeminino) return false;
    if (s.key === 'gestante' && !isFeminino) return false;
    return true;
  });

  async function salvar(fn: () => Promise<void>, proximaAba?: Step) {
    setIsSaving(true);
    try {
      await fn();
      if (proximaAba) {
        setCurrentStep(proximaAba);
      } else {
        Alert.alert('Salvo!', 'Prontuário salvo com sucesso.');
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <LoadingSpinner message="Carregando prontuário..." />;
  if (!morador || !prontuario) return null;

  const idade = calcularIdade(morador.data_nascimento);

  // Índice da aba atual para determinar próxima
  const idxAtual = stepsVisiveis.findIndex((s) => s.key === currentStep);
  const proximaAba = stepsVisiveis[idxAtual + 1]?.key;

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader
        title="Prontuário"
        subtitle={morador.nome}
        showBack
        backTo={`/(app)/morador/${morador.id}`}
      />

      {/* RESUMO DO PACIENTE */}
      <View style={styles.patientBar}>
        <View style={styles.patientInfo}>
          <Text style={styles.patientName} numberOfLines={1}>{morador.nome}</Text>
          <Text style={styles.patientMeta}>{traduzirSexo(morador.sexo)} • {idade} anos</Text>
        </View>
        <View style={styles.conditionBadges}>
          {prontuario.saude?.is_hipertenso && <Badge label="HAS" variant="hipertenso" />}
          {prontuario.saude?.is_diabetico && <Badge label="DM" variant="diabetico" />}
          {prontuario.saude?.is_domiciliado && <Badge label="Domiciliado" variant="warning" />}
        </View>
        <Text style={styles.versao}>v{prontuario.versao}</Text>
      </View>

      {/* ABAS DE NAVEGAÇÃO */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.stepsNav}
        contentContainerStyle={styles.stepsNavContent}
      >
        {stepsVisiveis.map((step) => (
          <TouchableOpacity
            key={step.key}
            style={[styles.stepTab, currentStep === step.key && styles.stepTabActive]}
            onPress={() => setCurrentStep(step.key)}
          >
            <Ionicons
              name={step.icon as keyof typeof Ionicons.glyphMap}
              size={14}
              color={currentStep === step.key ? COLORS.primary : COLORS.textLight}
            />
            <Text
              style={[styles.stepTabText, currentStep === step.key && styles.stepTabTextActive]}
              numberOfLines={1}
            >
              {step.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* CONTEÚDO */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* =========== SAÚDE GERAL =========== */}
        {currentStep === 'saude' && (
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Condições de saúde</Text>
            <SwitchField control={saudeControl} name="is_hipertenso" label="Hipertenso (HAS)" description="Pressão arterial elevada" />
            <SwitchField control={saudeControl} name="is_diabetico" label="Diabético" description="Diabetes mellitus" />
            <SwitchField control={saudeControl} name="is_domiciliado" label="Acamado/Domiciliado" />
            <SwitchField control={saudeControl} name="is_tuberculose" label="Tuberculose" description="Em tratamento" />
            <SwitchField control={saudeControl} name="is_hanseniase" label="Hanseníase" description="Em tratamento" />

            <Text style={styles.sectionTitle}>Aferições</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FormField control={saudeControl} name="pa_valor" label="Pressão arterial" placeholder="Ex: 120/80" />
              </View>
              <View style={{ flex: 1 }}>
                <FormField control={saudeControl} name="pa_ultima_aferição" label="Data aferição" placeholder="DD/MM/AAAA" mask={formatDateInput} keyboardType="numeric"
                  onBlur={() => { const v = getSaudeValues('pa_ultima_aferição'); if (v && !validarDataBR(v)) setSaudeValue('pa_ultima_aferição', ''); }}
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FormField control={saudeControl} name="hgt_valor" label="HGT (glicemia)" placeholder="Ex: 95" keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <FormField control={saudeControl} name="hgt_ultima_aferição" label="Data HGT" placeholder="DD/MM/AAAA" mask={formatDateInput} keyboardType="numeric"
                  onBlur={() => { const v = getSaudeValues('hgt_ultima_aferição'); if (v && !validarDataBR(v)) setSaudeValue('hgt_ultima_aferição', ''); }}
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Consultas e receitas</Text>
            <SwitchField control={saudeControl} name="tem_receita_atualizada" label="Receita médica atualizada?" />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FormField control={saudeControl} name="ultima_consulta" label="Última consulta" placeholder="DD/MM/AAAA" mask={formatDateInput} keyboardType="numeric"
                  onBlur={() => { const v = getSaudeValues('ultima_consulta'); if (v && !validarDataBR(v)) setSaudeValue('ultima_consulta', ''); }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormField control={saudeControl} name="proxima_consulta" label="Próxima consulta" placeholder="DD/MM/AAAA" mask={formatDateInput} keyboardType="numeric"
                  onBlur={() => { const v = getSaudeValues('proxima_consulta'); if (v && !validarDataBR(v)) setSaudeValue('proxima_consulta', ''); }}
                />
              </View>
            </View>
            <SwitchField control={saudeControl} name="precisa_agendamento" label="Precisa de agendamento?" />
            {precisaAgendamento && (
              <SelectField
                control={saudeControl} name="especialidade_agendamento" label="Especialidade"
                options={ESPECIALIDADES.map((e) => ({ label: e, value: e }))}
              />
            )}

            <Text style={styles.sectionTitle}>Observações da visita</Text>
            <FormField control={saudeControl} name="queixas" label="Queixas do paciente" placeholder="Descreva as queixas..." multiline numberOfLines={3} />
            <FormField control={saudeControl} name="observacoes" label="Observações do agente" placeholder="Observações gerais..." multiline numberOfLines={3} />

            <Button
              title={proximaAba ? 'Salvar e continuar' : 'Salvar dados de saúde'}
              onPress={handleSaude((data) => salvar(
                () => prontuarioRepository.salvarSaude(prontuario.id, data as any),
                proximaAba,
              ))}
              loading={isSaving}
            />
          </View>
        )}

        {/* =========== GESTANTE =========== */}
        {currentStep === 'gestante' && (
          <View style={styles.form}>
            <SwitchField control={gestanteControl} name="is_gestante" label="Paciente está gestante?" />
            {isGestante && (
              <>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <FormField control={gestanteControl} name="data_dum" label="DUM (última menstruação)" placeholder="DD/MM/AAAA" mask={formatDateInput} keyboardType="numeric"
                      onBlur={() => { const v = getGestanteValues('data_dum'); if (v && !validarDataBR(v)) setGestanteValue('data_dum', ''); }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FormField control={gestanteControl} name="semanas_gestacao" label="Semanas de gestação" placeholder="Ex: 32" keyboardType="numeric" />
                  </View>
                </View>
                <SwitchField control={gestanteControl} name="pre_natal_em_dia" label="Pré-natal em dia?" />
                <FormField control={gestanteControl} name="local_pre_natal" label="Local do pré-natal" placeholder="UBS, hospital..." />
                <FormField control={gestanteControl} name="proxima_consulta_pre_natal" label="Próxima consulta pré-natal" placeholder="DD/MM/AAAA" mask={formatDateInput} keyboardType="numeric"
                  onBlur={() => { const v = getGestanteValues('proxima_consulta_pre_natal'); if (v && !validarDataBR(v)) setGestanteValue('proxima_consulta_pre_natal', ''); }}
                />

                <Text style={styles.sectionTitle}>Vacinação e medicamentos</Text>
                <SwitchField control={gestanteControl} name="vacina_tetano_em_dia" label="Vacina antitetânica em dia?" />
                <SwitchField control={gestanteControl} name="vacina_hepatiteb_em_dia" label="Vacina hepatite B em dia?" />
                <SwitchField control={gestanteControl} name="sulfato_ferroso" label="Tomando sulfato ferroso?" />
                <SwitchField control={gestanteControl} name="acido_folico" label="Tomando ácido fólico?" />
              </>
            )}
            <FormField control={gestanteControl} name="observacoes" label="Observações" placeholder="Observações sobre a gestação..." multiline numberOfLines={3} />

            <Button
              title={proximaAba ? 'Salvar e continuar' : 'Salvar dados de gestante'}
              onPress={handleGestante((data) => salvar(
                () => prontuarioRepository.salvarGestante(prontuario.id, data as any),
                proximaAba,
              ))}
              loading={isSaving}
            />
          </View>
        )}

        {/* =========== PUERICULTURA =========== */}
        {currentStep === 'puericultura' && (
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Puericultura (criança até 2 anos)</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <FormField control={puericulturaControl} name="peso_atual" label="Peso atual (kg)" placeholder="Ex: 8.5" keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <FormField control={puericulturaControl} name="altura_atual" label="Altura (cm)" placeholder="Ex: 72" keyboardType="numeric" />
              </View>
            </View>
            <SwitchField control={puericulturaControl} name="cartao_vacina_em_dia" label="Cartão de vacina em dia?" />
            {!cartaoVacinaEmDia && (
              <FormField control={puericulturaControl} name="vacinas_em_atraso" label="Vacinas em atraso" placeholder="Quais vacinas estão em atraso?" multiline />
            )}
            <SwitchField control={puericulturaControl} name="consulta_acompanhamento_em_dia" label="Consulta de acompanhamento em dia?" />
            <FormField control={puericulturaControl} name="proxima_consulta" label="Próxima consulta" placeholder="DD/MM/AAAA" mask={formatDateInput} keyboardType="numeric"
              onBlur={() => { const v = getPuericulturaValues('proxima_consulta'); if (v && !validarDataBR(v)) setPuericulturaValue('proxima_consulta', ''); }}
            />
            <SwitchField control={puericulturaControl} name="frequenta_escola" label="Frequenta creche/escola?" />
            {frequentaEscola && (
              <FormField control={puericulturaControl} name="nome_escola" label="Nome da escola/creche" placeholder="Nome da instituição" />
            )}
            <FormField control={puericulturaControl} name="observacoes" label="Observações" multiline numberOfLines={3} />

            <Button
              title={proximaAba ? 'Salvar e continuar' : 'Salvar dados de puericultura'}
              onPress={handlePuericultura((data) => salvar(
                () => prontuarioRepository.salvarPuericultura(prontuario.id, data as any),
                proximaAba,
              ))}
              loading={isSaving}
            />
          </View>
        )}

        {/* =========== SAÚDE DA MULHER =========== */}
        {currentStep === 'mulher' && (
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Saúde da Mulher</Text>
            <FormField control={mulherControl} name="ultima_menstruacao" label="Última menstruação" placeholder="DD/MM/AAAA" mask={formatDateInput} keyboardType="numeric"
              onBlur={() => { const v = getMulherValues('ultima_menstruacao'); if (v && !validarDataBR(v)) setMulherValue('ultima_menstruacao', ''); }}
            />
            <SwitchField control={mulherControl} name="papanicolau_em_dia" label="Papanicolau (preventivo) em dia?" />
            {papanicolauEmDia && (
              <FormField control={mulherControl} name="data_ultimo_papanicolau" label="Data do último papanicolau" placeholder="DD/MM/AAAA" mask={formatDateInput} keyboardType="numeric"
                onBlur={() => { const v = getMulherValues('data_ultimo_papanicolau'); if (v && !validarDataBR(v)) setMulherValue('data_ultimo_papanicolau', ''); }}
              />
            )}
            <SwitchField control={mulherControl} name="mamografia_em_dia" label="Mamografia em dia?" />
            {mamografiaEmDia && (
              <FormField control={mulherControl} name="data_ultima_mamografia" label="Data da última mamografia" placeholder="DD/MM/AAAA" mask={formatDateInput} keyboardType="numeric"
                onBlur={() => { const v = getMulherValues('data_ultima_mamografia'); if (v && !validarDataBR(v)) setMulherValue('data_ultima_mamografia', ''); }}
              />
            )}
            <SwitchField control={mulherControl} name="usa_anticoncepcional" label="Usa anticoncepcional?" />
            {usaAnticoncepcional && (
              <FormField control={mulherControl} name="tipo_anticoncepcional" label="Qual anticoncepcional?" placeholder="Ex: Pílula, DIU..." />
            )}
            <SwitchField control={mulherControl} name="consulta_ginecologica_em_dia" label="Consulta ginecológica em dia?" />
            <SwitchField control={mulherControl} name="prevencao_dts" label="Orientada sobre prevenção de DTSs?" />
            <FormField control={mulherControl} name="observacoes" label="Observações" multiline numberOfLines={3} />

            <Button
              title={proximaAba ? 'Salvar e continuar' : 'Salvar dados'}
              onPress={handleMulher((data) => salvar(
                () => prontuarioRepository.salvarMulher(prontuario.id, data as any),
                proximaAba,
              ))}
              loading={isSaving}
            />
          </View>
        )}

        {/* =========== SOCIAL =========== */}
        {currentStep === 'social' && (
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Vulnerabilidade social</Text>
            <SelectField
              control={socialControl} name="vulnerabilidade_social" label="Nível de vulnerabilidade"
              options={[
                { label: 'Nenhuma', value: 'nenhum' },
                { label: 'Baixa', value: 'baixo' },
                { label: 'Média', value: 'medio' },
                { label: 'Alta', value: 'alto' },
                { label: 'Crítica', value: 'critico' },
              ]}
            />
            <FormField control={socialControl} name="descricao_vulnerabilidade" label="Descrição da vulnerabilidade" multiline numberOfLines={2} />

            <Text style={styles.sectionTitle}>Situações de risco</Text>
            <SwitchField control={socialControl} name="negligencia_parental" label="Suspeita de negligência parental?" />
            {negligencia && (
              <FormField control={socialControl} name="descricao_negligencia" label="Descreva a situação" multiline />
            )}
            <SwitchField control={socialControl} name="violencia_domestica" label="Suspeita de violência doméstica?" />
            {violencia && (
              <FormField control={socialControl} name="descricao_violencia" label="Descreva a situação" multiline />
            )}
            <SwitchField control={socialControl} name="depressao_suspeita" label="Suspeita de depressão?" />
            <SwitchField control={socialControl} name="uso_alcool_drogas" label="Uso de álcool ou drogas?" />
            {usoAlcool && (
              <FormField control={socialControl} name="descricao_uso" label="Descrição do uso" multiline />
            )}

            <Text style={styles.sectionTitle}>Encaminhamento</Text>
            <SwitchField control={socialControl} name="encaminhado_assistente_social" label="Encaminhado à assistente social?" />
            {encaminhadoAS && (
              <FormField control={socialControl} name="data_encaminhamento" label="Data do encaminhamento" placeholder="DD/MM/AAAA" mask={formatDateInput} keyboardType="numeric"
                onBlur={() => { const v = getSocialValues('data_encaminhamento'); if (v && !validarDataBR(v)) setSocialValue('data_encaminhamento', ''); }}
              />
            )}
            <FormField control={socialControl} name="observacoes" label="Observações gerais" multiline numberOfLines={3} />

            <Button
              title={proximaAba ? 'Salvar e continuar' : 'Salvar dados sociais'}
              onPress={handleSocial((data) => salvar(
                () => prontuarioRepository.salvarSocial(prontuario.id, data as any),
                proximaAba,
              ))}
              loading={isSaving}
            />
          </View>
        )}

        {/* =========== MEDICAMENTOS =========== */}
        {currentStep === 'medicamentos' && (
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Medicamentos e dúvidas</Text>
            <View style={styles.medicamentosInfo}>
              <Ionicons name="information-circle-outline" size={20} color={COLORS.info} />
              <Text style={styles.medicamentosText}>
                Registre dúvidas do paciente sobre medicamentos. O médico pode responder
                na próxima visita, ficando salvo no histórico.
              </Text>
            </View>
            <Button
              title="Gerenciar medicamentos"
              variant="ghost"
              onPress={() => Alert.alert('Em breve', 'Tela de medicamentos disponível em breve.')}
            />
          </View>
        )}

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function traduzirSexo(sexo: string): string {
  return { masculino: 'Masculino', feminino: 'Feminino', outro: 'Outro' }[sexo] ?? sexo;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  patientBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.white, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  patientInfo: { flex: 1 },
  patientName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  patientMeta: { fontSize: FONT_SIZE.xs, color: COLORS.textLight },
  conditionBadges: { flexDirection: 'row', gap: 4 },
  versao: { fontSize: FONT_SIZE.xs, color: COLORS.placeholder },
  stepsNav: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, maxHeight: 52 },
  stepsNavContent: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, gap: SPACING.xs, flexDirection: 'row', alignItems: 'center' },
  stepTab: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: 6,
    borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.borderLight,
    flexShrink: 0,
  },
  stepTabActive: { borderColor: COLORS.primary, backgroundColor: COLORS.infoLight },
  stepTabText: { fontSize: FONT_SIZE.xs, color: COLORS.textLight, fontWeight: '600' },
  stepTabTextActive: { color: COLORS.primary },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  form: { gap: SPACING.md },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.primary, marginTop: SPACING.sm },
  row: { flexDirection: 'row', gap: SPACING.sm },
  medicamentosInfo: {
    flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start',
    backgroundColor: COLORS.infoLight, padding: SPACING.md, borderRadius: RADIUS.sm,
  },
  medicamentosText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 20 },
});
