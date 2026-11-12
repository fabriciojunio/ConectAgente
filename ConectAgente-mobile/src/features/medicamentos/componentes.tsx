import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '../../components/forms/FormField';
import { Button } from '../../components/button';
import { Card } from '../../components/ui/Card';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '../../utils/constants';
import { formatDate } from '../../utils/formatters';
import type { Medicamento } from '../../database/repositories/medicamentoRepository';
import {
  PROBLEMAS_DE_USO, PROFISSIONAIS, lerProblemas, medicamentoSchema, respostaSchema,
  rotuloDoProblema, rotuloDoProfissional, situacaoDaDuvida,
  type MedicamentoForm, type MedicamentoFormInput, type Profissional, type RespostaForm,
} from './regras';

/** Botão de escolha que liga e desliga, usado nos problemas e no profissional. */
function Opcao({ rotulo, marcada, onPress }: { rotulo: string; marcada: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => criarEstilos(colors), [colors]);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.opcao, marcada && styles.opcaoMarcada]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada }}
    >
      {marcada && <Ionicons name="checkmark" size={14} color={colors.primary} />}
      <Text style={[styles.opcaoTexto, marcada && styles.opcaoTextoMarcada]}>{rotulo}</Text>
    </TouchableOpacity>
  );
}

const VAZIO: MedicamentoFormInput = { nome: '', dosagem: '', frequencia: '', duvida: '' };

export function FormularioDoMedicamento({
  onSalvar,
  onCancelar,
}: {
  onSalvar: (dados: MedicamentoForm, problemas: string[]) => Promise<void>;
  onCancelar: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => criarEstilos(colors), [colors]);
  const [problemas, setProblemas] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const { control, handleSubmit, reset } = useForm<MedicamentoFormInput, unknown, MedicamentoForm>({
    resolver: zodResolver(medicamentoSchema),
    defaultValues: VAZIO,
  });

  function alternar(valor: string) {
    setProblemas((atual) => (atual.includes(valor) ? atual.filter((p) => p !== valor) : [...atual, valor]));
  }

  async function salvar(dados: MedicamentoForm) {
    setSalvando(true);
    try {
      await onSalvar(dados, problemas);
      reset(VAZIO);
      setProblemas([]);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card style={styles.formulario}>
      <Text style={styles.tituloDoFormulario}>Novo medicamento</Text>
      <FormField control={control} name="nome" label="Nome do medicamento" placeholder="Ex: Losartana" required />
      <View style={styles.linha}>
        <View style={styles.metade}>
          <FormField control={control} name="dosagem" label="Dose" placeholder="Ex: 50 mg" />
        </View>
        <View style={styles.metade}>
          <FormField control={control} name="frequencia" label="Quando toma" placeholder="Ex: 8h e 20h" />
        </View>
      </View>

      <Text style={styles.rotulo}>Problemas observados no uso</Text>
      <View style={styles.opcoes}>
        {PROBLEMAS_DE_USO.map((p) => (
          <Opcao key={p.value} rotulo={p.label} marcada={problemas.includes(p.value)} onPress={() => alternar(p.value)} />
        ))}
      </View>

      <FormField
        control={control}
        name="duvida"
        label="Dúvida para a equipe"
        placeholder="O que o morador quer saber? Sem nome nem documento."
        multiline
        numberOfLines={3}
      />

      <View style={styles.linha}>
        <View style={styles.metade}>
          <Button title="Cancelar" variant="ghost" onPress={onCancelar} />
        </View>
        <View style={styles.metade}>
          <Button title="Salvar" onPress={handleSubmit(salvar)} loading={salvando} />
        </View>
      </View>
    </Card>
  );
}

function FormularioDaResposta({
  onSalvar,
  onCancelar,
}: {
  onSalvar: (resposta: RespostaForm) => Promise<void>;
  onCancelar: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => criarEstilos(colors), [colors]);
  const [profissional, setProfissional] = useState<Profissional | null>(null);
  const [erroDoProfissional, setErroDoProfissional] = useState('');
  const [salvando, setSalvando] = useState(false);
  const { control, handleSubmit } = useForm<{ resposta: string }>({ defaultValues: { resposta: '' } });

  async function salvar({ resposta }: { resposta: string }) {
    const validado = respostaSchema.safeParse({ respondido_por: profissional ?? undefined, resposta });
    if (!validado.success) {
      setErroDoProfissional(validado.error.issues[0].message);
      return;
    }
    setSalvando(true);
    try {
      await onSalvar(validado.data);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <View style={styles.resposta}>
      <Text style={styles.rotulo}>Quem respondeu</Text>
      <View style={styles.opcoes}>
        {PROFISSIONAIS.map((p) => (
          <Opcao
            key={p.value}
            rotulo={p.label}
            marcada={profissional === p.value}
            onPress={() => {
              setProfissional(p.value);
              setErroDoProfissional('');
            }}
          />
        ))}
      </View>
      <FormField
        control={control}
        name="resposta"
        label="Resposta da equipe"
        placeholder="Anote a orientação como a equipe passou, sem nome"
        multiline
        numberOfLines={3}
      />
      {erroDoProfissional ? <Text style={styles.erro}>{erroDoProfissional}</Text> : null}
      <View style={styles.linha}>
        <View style={styles.metade}>
          <Button title="Cancelar" variant="ghost" onPress={onCancelar} />
        </View>
        <View style={styles.metade}>
          <Button title="Salvar resposta" onPress={handleSubmit(salvar)} loading={salvando} />
        </View>
      </View>
    </View>
  );
}

export function CartaoDoMedicamento({
  medicamento,
  onResponder,
  onRemover,
}: {
  medicamento: Medicamento;
  onResponder: (resposta: RespostaForm) => Promise<void>;
  onRemover: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => criarEstilos(colors), [colors]);
  const [respondendo, setRespondendo] = useState(false);
  const situacao = situacaoDaDuvida(medicamento);
  const problemas = lerProblemas(medicamento.problemas_uso);
  const detalhes = [medicamento.dosagem, medicamento.frequencia].filter(Boolean).join(' • ');

  return (
    <Card style={styles.cartao}>
      <View style={styles.cabecalhoDoCartao}>
        <Ionicons name="medkit-outline" size={22} color={colors.primary} />
        <View style={styles.flex}>
          <Text style={styles.nome}>{medicamento.nome}</Text>
          {detalhes ? <Text style={styles.detalhes}>{detalhes}</Text> : null}
        </View>
        <TouchableOpacity onPress={onRemover} hitSlop={10} accessibilityLabel={`Remover ${medicamento.nome}`}>
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>

      {problemas.length > 0 && (
        <View style={styles.opcoes}>
          {problemas.map((p) => (
            <View key={p} style={styles.selo}>
              <Text style={styles.seloTexto}>{rotuloDoProblema(p)}</Text>
            </View>
          ))}
        </View>
      )}

      {situacao !== 'sem_duvida' && (
        <View style={[styles.duvida, situacao === 'respondida' ? styles.duvidaRespondida : styles.duvidaAguardando]}>
          <Text style={styles.duvidaTitulo}>
            {situacao === 'respondida' ? 'Dúvida respondida' : 'Aguardando resposta da equipe'}
          </Text>
          <Text style={styles.duvidaTexto}>{medicamento.duvida}</Text>
          {situacao === 'respondida' && (
            <>
              <Text style={styles.respostaTitulo}>
                {rotuloDoProfissional(medicamento.respondido_por)}
                {medicamento.data_resposta ? ` em ${formatDate(medicamento.data_resposta)}` : ''}
              </Text>
              <Text style={styles.duvidaTexto}>{medicamento.resposta_medico}</Text>
            </>
          )}
        </View>
      )}

      {situacao === 'aguardando' &&
        (respondendo ? (
          <FormularioDaResposta
            onCancelar={() => setRespondendo(false)}
            onSalvar={async (r) => {
              await onResponder(r);
              setRespondendo(false);
            }}
          />
        ) : (
          <Button title="Registrar resposta da equipe" variant="secondary" onPress={() => setRespondendo(true)} />
        ))}
    </Card>
  );
}

function criarEstilos(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    linha: { flexDirection: 'row', gap: SPACING.sm },
    metade: { flex: 1 },
    formulario: { gap: SPACING.md },
    tituloDoFormulario: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: colors.text },
    rotulo: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: colors.text },
    opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
    opcao: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: SPACING.sm, paddingVertical: 6,
      borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    opcaoMarcada: { borderColor: colors.primary, backgroundColor: colors.infoLight },
    opcaoTexto: { fontSize: FONT_SIZE.sm, color: colors.textMedium },
    opcaoTextoMarcada: { color: colors.primary, fontWeight: '600' },
    cartao: { gap: SPACING.sm },
    cabecalhoDoCartao: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    nome: { fontSize: FONT_SIZE.md, fontWeight: '700', color: colors.text },
    detalhes: { fontSize: FONT_SIZE.sm, color: colors.textLight },
    selo: {
      paddingHorizontal: SPACING.sm, paddingVertical: 4,
      borderRadius: RADIUS.full, backgroundColor: colors.warningLight,
    },
    seloTexto: { fontSize: FONT_SIZE.xs, color: colors.warning, fontWeight: '600' },
    duvida: { borderRadius: RADIUS.md, padding: SPACING.sm, gap: 4, borderLeftWidth: 4 },
    duvidaAguardando: { backgroundColor: colors.warningLight, borderLeftColor: colors.warning },
    duvidaRespondida: { backgroundColor: colors.successLight, borderLeftColor: colors.success },
    duvidaTitulo: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: colors.text },
    duvidaTexto: { fontSize: FONT_SIZE.sm, color: colors.textMedium, lineHeight: 20 },
    respostaTitulo: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: colors.success, marginTop: 4 },
    resposta: { gap: SPACING.sm },
    erro: { fontSize: FONT_SIZE.xs, color: colors.error },
  });
}
