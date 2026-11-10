import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FormField } from '../../components/forms/FormField';
import { Button } from '../../components/button';
import { PageHeader } from '../../components/ui/PageHeader';
import { CodigoRecuperacao } from '../../components/ui/CodigoRecuperacao';
import { formatCPF, stripCPF } from '../../utils/formatters';
import { validarCPF } from '../../utils/validators';
import { authService, AVISO_SENHA_DO_SERVIDOR } from '../../services/authService';
import { SPACING, FONT_SIZE, RADIUS, VALIDATION } from '../../utils/constants';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';

/**
 * Recuperação de senha por CPF e código de recuperação.
 *
 * Antes pedia CPF e e-mail. Nenhum dos dois é segredo: o CPF do
 * administrador aparecia na tela de entrada e o e-mail dele estava no
 * código-fonte, e qualquer pessoa com o aparelho na mão trocava a senha do
 * administrador. O código de recuperação é mostrado só ao dono da conta, no
 * cadastro, e o administrador pode gerar um novo para um agente.
 *
 * O código é conferido junto com a troca, num passo só. Conferir antes e
 * trocar depois abriria a janela de quem passa da primeira etapa e volta à
 * segunda com outro CPF.
 */
const recuperacaoSchema = z.object({
  cpf: z.string().refine(validarCPF, 'CPF inválido'),
  codigo: z.string().min(12, 'O código tem 12 letras e números'),
  nova_senha: z.string().min(VALIDATION.SENHA_MIN_LENGTH, `Mínimo ${VALIDATION.SENHA_MIN_LENGTH} caracteres`),
  confirmar_senha: z.string(),
}).refine((d) => d.nova_senha === d.confirmar_senha, {
  path: ['confirmar_senha'],
  message: 'As senhas não coincidem',
});
type RecuperacaoForm = z.infer<typeof recuperacaoSchema>;

export default function RecuperarSenha() {
  const { colors } = useTheme();
  const styles = useMemo(() => criarStyles(colors), [colors]);
  // Preenchido quando a troca dá certo: é o código novo, para mostrar.
  const [novoCodigo, setNovoCodigo] = useState<string | null>(null);
  const [servidorAtualizado, setServidorAtualizado] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RecuperacaoForm>({
    resolver: zodResolver(recuperacaoSchema),
    mode: 'onBlur',
  });

  async function onRedefinir(data: RecuperacaoForm) {
    setIsLoading(true);
    try {
      const resultado = await authService.recuperarSenha(
        stripCPF(data.cpf),
        data.codigo,
        data.nova_senha
      );
      if (!resultado) {
        // Mensagem genérica: não diz se o erro foi no CPF ou no código.
        Alert.alert(
          'Não foi possível redefinir',
          'O CPF ou o código de recuperação não conferem.\n\n' +
            'Se você não tem o código, peça ao administrador do aparelho para gerar um novo.'
        );
        return;
      }
      setServidorAtualizado(resultado.servidorAtualizado);
      setNovoCodigo(resultado.codigo);
    } catch (erro) {
      Alert.alert(
        'Não foi possível redefinir',
        erro instanceof Error ? erro.message : 'Tente novamente.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (novoCodigo) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.infoBanner}>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
            <Text style={styles.infoBannerText}>
              Senha redefinida. O código que você usou não vale mais; anote o novo abaixo.
            </Text>
          </View>
          {!servidorAtualizado && (
            <View style={styles.infoBanner}>
              <Ionicons name="cloud-offline-outline" size={20} color={colors.warning} />
              <Text style={styles.infoBannerText}>{AVISO_SENHA_DO_SERVIDOR}</Text>
            </View>
          )}
          <CodigoRecuperacao
            codigo={novoCodigo}
            tituloDoBotao="Já anotei, ir para o login"
            onConfirmar={() => router.replace('/(auth)/login')}
          />
          <Text style={styles.lgpd}>
            Esta ação foi registrada nos logs do sistema (LGPD: Art. 37).
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader title="Recuperar Senha" showBack />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.infoBanner}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
            <Text style={styles.infoBannerText}>
              Informe o CPF e o código de recuperação que apareceu quando a conta foi
              criada (formato XXXX-XXXX-XXXX). Sem o código, peça ao administrador do
              aparelho para gerar um novo.
            </Text>
          </View>

          <View style={styles.form}>
            <FormField
              control={form.control}
              name="cpf"
              label="CPF"
              placeholder="000.000.000-00"
              keyboardType="numeric"
              mask={formatCPF}
              required
            />
            <FormField
              control={form.control}
              name="codigo"
              label="Código de recuperação"
              placeholder="XXXX-XXXX-XXXX"
              autoCorrect={false}
              required
            />
            <FormField
              control={form.control}
              name="nova_senha"
              label="Nova senha"
              placeholder={`Mínimo ${VALIDATION.SENHA_MIN_LENGTH} caracteres`}
              secureTextEntry
              required
            />
            <FormField
              control={form.control}
              name="confirmar_senha"
              label="Confirmar nova senha"
              placeholder="Repita a senha"
              secureTextEntry
              required
            />
            <Button
              title="Redefinir senha"
              onPress={form.handleSubmit(onRedefinir, () => {
                Alert.alert('Campos inválidos', 'Confira o CPF, o código e a senha.');
              })}
              loading={isLoading}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const criarStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: SPACING.xl },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: colors.infoLight,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
  },
  infoBannerText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: colors.text,
    lineHeight: 20,
  },
  form: { gap: SPACING.md },
  lgpd: {
    fontSize: FONT_SIZE.xs,
    color: colors.placeholder,
    textAlign: 'center',
    lineHeight: 18,
  },
});
