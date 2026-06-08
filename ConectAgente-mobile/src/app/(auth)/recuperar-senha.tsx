import React, { useState } from 'react';
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
import { formatCPF, stripCPF } from '../../utils/formatters';
import { validarCPF } from '../../utils/validators';
import { agenteRepository } from '../../database/repositories/agenteRepository';
import { COLORS, SPACING, FONT_SIZE, RADIUS, VALIDATION } from '../../utils/constants';

// ─── Etapa 1: verificar identidade ───────────────────────────
const verificacaoSchema = z.object({
  cpf: z.string().refine(validarCPF, 'CPF inválido'),
  email: z.string().email('E-mail inválido'),
});
type VerificacaoForm = z.infer<typeof verificacaoSchema>;

// ─── Etapa 2: nova senha ──────────────────────────────────────
const novaSenhaSchema = z.object({
  nova_senha: z.string().min(VALIDATION.SENHA_MIN_LENGTH, `Mínimo ${VALIDATION.SENHA_MIN_LENGTH} caracteres`),
  confirmar_senha: z.string(),
}).refine((d) => d.nova_senha === d.confirmar_senha, {
  path: ['confirmar_senha'],
  message: 'As senhas não coincidem',
});
type NovaSenhaForm = z.infer<typeof novaSenhaSchema>;

export default function RecuperarSenha() {
  const [etapa, setEtapa] = useState<'verificar' | 'nova-senha' | 'sucesso'>('verificar');
  const [cpfVerificado, setCpfVerificado] = useState('');
  const [emailVerificado, setEmailVerificado] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const verificacaoForm = useForm<VerificacaoForm>({
    resolver: zodResolver(verificacaoSchema),
    mode: 'onBlur',
  });

  const novaSenhaForm = useForm<NovaSenhaForm>({
    resolver: zodResolver(novaSenhaSchema),
    mode: 'onBlur',
  });

  async function onVerificar(data: VerificacaoForm) {
    setIsLoading(true);
    try {
      const cpfLimpo = stripCPF(data.cpf);
      const ok = await agenteRepository.verificarIdentidade(cpfLimpo, data.email);

      // Aguarda sempre o mesmo tempo para evitar ataques de temporização
      await new Promise((r) => setTimeout(r, 800));

      if (!ok) {
        // Mensagem genérica — não revela qual campo é inválido (LGPD)
        Alert.alert(
          'Dados não encontrados',
          'CPF e e-mail não correspondem a nenhum agente cadastrado neste dispositivo.\n\nVerifique os dados e tente novamente.',
          [{ text: 'OK' }]
        );
        return;
      }

      setCpfVerificado(cpfLimpo);
      setEmailVerificado(data.email);
      setEtapa('nova-senha');
    } finally {
      setIsLoading(false);
    }
  }

  async function onRedefinir(data: NovaSenhaForm) {
    setIsLoading(true);
    try {
      const ok = await agenteRepository.resetarSenha(cpfVerificado, emailVerificado, data.nova_senha);
      if (!ok) {
        Alert.alert('Erro', 'Não foi possível redefinir a senha. Tente novamente.');
        return;
      }
      setEtapa('sucesso');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader title="Recuperar Senha" showBack />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ── ETAPA 1: VERIFICAÇÃO DE IDENTIDADE ── */}
          {etapa === 'verificar' && (
            <>
              {/* Indicador de etapa */}
              <View style={styles.stepRow}>
                <View style={[styles.stepDot, styles.stepDotActive]}>
                  <Text style={styles.stepDotText}>1</Text>
                </View>
                <View style={styles.stepLine} />
                <View style={styles.stepDot}>
                  <Text style={styles.stepDotText}>2</Text>
                </View>
              </View>

              <View style={styles.infoBanner}>
                <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
                <Text style={styles.infoBannerText}>
                  Para sua segurança e em conformidade com a LGPD, confirme sua identidade
                  informando o CPF e o e-mail cadastrados no sistema.
                </Text>
              </View>

              <View style={styles.form}>
                <FormField
                  control={verificacaoForm.control}
                  name="cpf"
                  label="CPF cadastrado"
                  placeholder="000.000.000-00"
                  keyboardType="numeric"
                  mask={formatCPF}
                  required
                />
                <FormField
                  control={verificacaoForm.control}
                  name="email"
                  label="E-mail cadastrado"
                  placeholder="email@exemplo.com"
                  keyboardType="email-address"
                  required
                />
                <Button
                  title="Verificar identidade"
                  onPress={verificacaoForm.handleSubmit(onVerificar, () => {
                    Alert.alert('Campos inválidos', 'Verifique o CPF e o e-mail informados.');
                  })}
                  loading={isLoading}
                />
              </View>

              <Text style={styles.lgpd}>
                Os dados informados são usados exclusivamente para verificação de identidade
                e não são compartilhados com terceiros (LGPD — Art. 7º, II).
              </Text>
            </>
          )}

          {/* ── ETAPA 2: NOVA SENHA ── */}
          {etapa === 'nova-senha' && (
            <>
              <View style={styles.stepRow}>
                <View style={[styles.stepDot, styles.stepDotDone]}>
                  <Ionicons name="checkmark" size={14} color={COLORS.white} />
                </View>
                <View style={[styles.stepLine, styles.stepLineDone]} />
                <View style={[styles.stepDot, styles.stepDotActive]}>
                  <Text style={styles.stepDotText}>2</Text>
                </View>
              </View>

              <View style={styles.infoBanner}>
                <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.success} />
                <Text style={styles.infoBannerText}>
                  Identidade confirmada. Crie uma senha forte com pelo menos {VALIDATION.SENHA_MIN_LENGTH} caracteres.
                </Text>
              </View>

              <View style={styles.form}>
                <FormField
                  control={novaSenhaForm.control}
                  name="nova_senha"
                  label="Nova senha"
                  placeholder={`Mínimo ${VALIDATION.SENHA_MIN_LENGTH} caracteres`}
                  secureTextEntry
                  required
                />
                <FormField
                  control={novaSenhaForm.control}
                  name="confirmar_senha"
                  label="Confirmar nova senha"
                  placeholder="Repita a senha"
                  secureTextEntry
                  required
                />
                <Button
                  title="Redefinir senha"
                  onPress={novaSenhaForm.handleSubmit(onRedefinir, () => {
                    Alert.alert('Campos inválidos', 'Verifique a senha e a confirmação.');
                  })}
                  loading={isLoading}
                />
              </View>
            </>
          )}

          {/* ── SUCESSO ── */}
          {etapa === 'sucesso' && (
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={72} color={COLORS.success} />
              </View>
              <Text style={styles.successTitle}>Senha redefinida!</Text>
              <Text style={styles.successText}>
                Sua senha foi alterada com sucesso. Você já pode entrar com a nova senha.
              </Text>
              <Text style={styles.auditText}>
                Esta ação foi registrada nos logs do sistema (LGPD — Art. 37).
              </Text>
              <Button
                title="Ir para o login"
                onPress={() => router.replace('/(auth)/login')}
              />
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: SPACING.xl },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    marginBottom: SPACING.sm,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: COLORS.primary },
  stepDotDone: { backgroundColor: COLORS.success },
  stepDotText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.white },
  stepLine: { flex: 1, maxWidth: 80, height: 2, backgroundColor: COLORS.borderLight },
  stepLineDone: { backgroundColor: COLORS.success },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.infoLight,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
  },
  infoBannerText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    lineHeight: 20,
  },
  form: { gap: SPACING.md },
  lgpd: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.placeholder,
    textAlign: 'center',
    lineHeight: 18,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    gap: SPACING.md,
    paddingTop: SPACING.xl,
  },
  successIcon: { marginBottom: SPACING.sm },
  successTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800',
    color: COLORS.success,
  },
  successText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  auditText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.placeholder,
    textAlign: 'center',
    lineHeight: 18,
  },
});
