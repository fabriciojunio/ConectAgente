import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { PageHeader } from '../../../components/ui/PageHeader';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Button } from '../../../components/button';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme, type ThemeColors } from '../../../contexts/ThemeContext';
import { moradorRepository } from '../../../database/repositories/moradorRepository';
import { CartaoDoMedicamento, FormularioDoMedicamento } from '../../../features/medicamentos/componentes';
import { useMedicamentos } from '../../../features/medicamentos/useMedicamentos';
import { situacaoDaDuvida } from '../../../features/medicamentos/regras';
import { FONT_SIZE, SPACING, RADIUS } from '../../../utils/constants';

export default function MedicamentosDoMorador() {
  const { colors } = useTheme();
  const styles = useMemo(() => criarEstilos(colors), [colors]);
  const { moradorId } = useLocalSearchParams<{ moradorId: string }>();
  const { agente } = useAuth();
  const { medicamentos, carregando, adicionar, responder, remover } = useMedicamentos(moradorId, agente?.id);
  const [nome, setNome] = useState('');
  const [adicionando, setAdicionando] = useState(false);

  // A tela fica montada entre um morador e outro: o formulário aberto não
  // pode passar de um para o outro.
  useFocusEffect(
    useCallback(() => {
      setAdicionando(false);
    }, [moradorId])
  );

  useEffect(() => {
    if (!moradorId) return;
    moradorRepository.buscarPorId(moradorId).then((m) => setNome(m?.nome ?? ''));
  }, [moradorId]);

  const aguardando = medicamentos.filter((m) => situacaoDaDuvida(m) === 'aguardando').length;

  function confirmarRemocao(id: string, nomeDoRemedio: string) {
    Alert.alert('Remover medicamento', `Tirar ${nomeDoRemedio} da lista deste morador?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => {
          remover(id).catch(() => Alert.alert('Erro', 'Não foi possível remover. Tente de novo.'));
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageHeader
        title="Medicamentos"
        subtitle={nome || undefined}
        showBack
        backTo={moradorId ? `/(app)/prontuario/${moradorId}` : undefined}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
          {aguardando > 0 && (
            <View style={styles.aviso}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.warning} />
              <Text style={styles.avisoTexto}>
                {aguardando === 1
                  ? '1 dúvida esperando resposta da equipe'
                  : `${aguardando} dúvidas esperando resposta da equipe`}
              </Text>
            </View>
          )}

          {adicionando ? (
            <FormularioDoMedicamento
              onCancelar={() => setAdicionando(false)}
              onSalvar={async (dados, problemas) => {
                try {
                  await adicionar(dados, problemas);
                  setAdicionando(false);
                } catch (erro) {
                  Alert.alert('Erro', erro instanceof Error ? erro.message : 'Não foi possível salvar.');
                }
              }}
            />
          ) : (
            <Button
              title="Adicionar medicamento"
              icon={<Ionicons name="add" size={20} color={colors.onSolid} />}
              onPress={() => setAdicionando(true)}
            />
          )}

          {!carregando && medicamentos.length === 0 && !adicionando && (
            <EmptyState
              icon="medkit-outline"
              title="Nenhum medicamento"
              description="Adicione os remédios que o morador usa para acompanhar o uso e as dúvidas."
            />
          )}

          {medicamentos.map((m) => (
            <CartaoDoMedicamento
              key={m.id}
              medicamento={m}
              onResponder={(r) => responder(m.id, r)}
              onRemover={() => confirmarRemocao(m.id, m.nome)}
            />
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function criarEstilos(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    conteudo: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },
    aviso: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      padding: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: colors.warningLight,
    },
    avisoTexto: { flex: 1, fontSize: FONT_SIZE.sm, fontWeight: '600', color: colors.text },
  });
}
