import React, { useState } from 'react';
import {
  View, Text, Image, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { FormField } from '../../components/forms/FormField';
import { Button } from '../../components/button';
import { loginSchema, LoginFormData } from '../../utils/validators';
import { formatCPF, stripCPF } from '../../utils/formatters';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../utils/constants';
import { agenteRepository } from '../../database/repositories/agenteRepository';

export default function Login() {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const { control, handleSubmit } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { cpf: '', senha: '' },
  });

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true);
    try {
      const agente = await login(stripCPF(data.cpf), data.senha);
      router.replace(agente.is_admin ? '/(admin)' : '/(app)');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao fazer login';
      Alert.alert('Erro', msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function irParaCadastro() {
    const tem = await agenteRepository.existeAgenteCadastrado();
    if (!tem) {
      router.push('/(auth)/cadastro');
    } else {
      Alert.alert(
        'Cadastro não disponível',
        'Já existe um agente cadastrado neste dispositivo. Use "Esqueci a senha" se precisar de acesso.',
        [{ text: 'OK' }]
      );
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* LOGO */}
        <LinearGradient
          colors={COLORS.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.logoArea, { paddingTop: insets.top + SPACING.md }]}
        >
          <View style={styles.logoCard}>
            <Image
              source={require('../../../assets/images/LOGO-remove-title.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.appName}>ConectAgente</Text>
          <Text style={styles.appSubtitle}>Sistema de Visitas Domiciliares</Text>
        </LinearGradient>

        {/* FORMULÁRIO + LGPD */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Entrar</Text>
          <Text style={styles.formSubtitle}>Acesso restrito a Agentes Comunitários de Saúde</Text>

          <View style={styles.form}>
            <FormField
              control={control}
              name="cpf"
              label="CPF"
              placeholder="000.000.000-00"
              keyboardType="numeric"
              mask={formatCPF}
              required
            />

            <FormField
              control={control}
              name="senha"
              label="Senha"
              placeholder="Digite sua senha"
              secureTextEntry
              required
            />

            <Button
              title="Entrar"
              onPress={handleSubmit(onSubmit)}
              loading={isLoading}
            />

            <Button
              title="Primeiro acesso"
              variant="ghost"
              onPress={irParaCadastro}
            />

            <Button
              title="Esqueci minha senha"
              variant="ghost"
              onPress={() => router.push('/(auth)/recuperar-senha')}
            />
          </View>

          {/* FOOTER LGPD — fixo no fundo do formContainer */}
          <Text style={styles.lgpd}>
            Este sistema está em conformidade com a LGPD (Lei 13.709/2018).
            Os dados coletados são utilizados exclusivamente para fins de saúde pública.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  logoArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.xs,
  },
  logoCard: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  logo: {
    width: 64,
    height: 64,
  },
  appName: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  formContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  formTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.primary,
  },
  formSubtitle: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    marginBottom: SPACING.sm,
  },
  form: {
    gap: SPACING.sm,
  },
  lgpd: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.placeholder,
    textAlign: 'center',
    paddingTop: SPACING.sm,
  },
});
