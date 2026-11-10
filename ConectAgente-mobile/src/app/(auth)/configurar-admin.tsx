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
import { formatCPF } from '../../utils/formatters';
import { ADMIN_CPF, agenteRepository } from '../../database/repositories/agenteRepository';
import { SPACING, FONT_SIZE, RADIUS, VALIDATION } from '../../utils/constants';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';

/**
 * Primeiro uso do aparelho: quem instala escolhe a senha do administrador.
 *
 * Substitui o aviso que mostrava a senha sorteada na tela de entrada. Ali a
 * senha ficava visível para qualquer pessoa que abrisse o aplicativo, até
 * alguém tocar em "Já anotei" numa tela que nem todo mundo achava.
 *
 * O que continua igual: quem abre o aplicativo primeiro num aparelho novo é
 * quem configura o administrador. Isso é inerente a uma conta que existe só
 * no aparelho, sem servidor para confirmar quem é quem. A diferença é que
 * agora, depois de configurada, não sobra senha nenhuma à vista, e a tela
 * some sozinha porque depende do estado da conta, e não de um aviso.
 */
const configuracaoSchema = z.object({
  senha: z.string().min(VALIDATION.SENHA_MIN_LENGTH, `Mínimo ${VALIDATION.SENHA_MIN_LENGTH} caracteres`),
  confirmar_senha: z.string(),
}).refine((d) => d.senha === d.confirmar_senha, {
  path: ['confirmar_senha'],
  message: 'As senhas não coincidem',
});
type ConfiguracaoForm = z.infer<typeof configuracaoSchema>;

export default function ConfigurarAdmin() {
  const { colors } = useTheme();
  const styles = useMemo(() => criarStyles(colors), [colors]);
  const [isLoading, setIsLoading] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);

  const form = useForm<ConfiguracaoForm>({
    resolver: zodResolver(configuracaoSchema),
    mode: 'onBlur',
  });

  async function onConfigurar(data: ConfiguracaoForm) {
    setIsLoading(true);
    try {
      setCodigo(await agenteRepository.configurarAdmin(data.senha));
    } catch (erro) {
      Alert.alert(
        'Não foi possível configurar',
        erro instanceof Error ? erro.message : 'Tente novamente.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (codigo) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <CodigoRecuperacao
            codigo={codigo}
            tituloDoBotao="Já anotei, ir para o login"
            onConfirmar={() => router.replace('/(auth)/login')}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader title="Configurar administrador" showBack />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.infoBanner}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
            <Text style={styles.infoBannerText}>
              Este aparelho ainda não tem administrador. Escolha a senha agora: depois
              disso, entre com o CPF {formatCPF(ADMIN_CPF)} e a senha escolhida.
            </Text>
          </View>

          <View style={styles.form}>
            <FormField
              control={form.control}
              name="senha"
              label="Senha do administrador"
              placeholder={`Mínimo ${VALIDATION.SENHA_MIN_LENGTH} caracteres`}
              secureTextEntry
              required
            />
            <FormField
              control={form.control}
              name="confirmar_senha"
              label="Confirmar senha"
              placeholder="Repita a senha"
              secureTextEntry
              required
            />
            <Button
              title="Definir senha"
              onPress={form.handleSubmit(onConfigurar)}
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
    infoBannerText: { flex: 1, fontSize: FONT_SIZE.sm, color: colors.text, lineHeight: 20 },
    form: { gap: SPACING.md },
  });
