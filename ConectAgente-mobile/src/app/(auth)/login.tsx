import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, Image, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
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
import { SPACING, FONT_SIZE, RADIUS } from '../../utils/constants';
import { agenteRepository } from '../../database/repositories/agenteRepository';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';

export default function Login() {
  const { colors } = useTheme();
  const styles = useMemo(() => criarStyles(colors), [colors]);
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const insets = useSafeAreaInsets();

  /**
   * Administrador ainda sem senha neste aparelho.
   *
   * Antes esta tela mostrava a senha sorteada do administrador para quem
   * abrisse o aplicativo. O texto dizia que o aviso sumia quando a senha
   * fosse trocada, mas nada apagava o aviso na troca: a senha válida ficava
   * à vista até alguém tocar em "Já anotei" dentro da área administrativa.
   *
   * Agora a tela não mostra senha nenhuma. Enquanto a conta não tem senha,
   * aparece o botão para configurar; quando tem, o botão some, porque depende
   * do estado da conta e não de um aviso que alguém precisa lembrar de tirar.
   *
   * Confere de novo a cada vez que a tela ganha foco, para o botão sumir ao
   * voltar da configuração.
   */
  const [adminSemSenha, setAdminSemSenha] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      agenteRepository
        .adminPrecisaConfigurar()
        .then((precisa) => {
          if (vivo) setAdminSemSenha(precisa);
        })
        .catch(() => {
          // Banco indisponível não pode derrubar a tela de login.
        });
      return () => {
        vivo = false;
      };
    }, [])
  );

  const { control, handleSubmit } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { cpf: '', senha: '' },
  });

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true);
    try {
      const { agente, aviso } = await login(stripCPF(data.cpf), data.senha);
      router.replace(agente.is_admin ? '/(admin)' : '/(app)');
      if (aviso) Alert.alert('Sincronização parada', aviso);
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
        {/* Rolagem porque, com o aviso do administrador, o conteúdo passa da
            altura da tela: sem ela o botão "Configurar administrador" e o
            rodapé da LGPD ficavam embaixo dos botões do Android, sem alcance. */}
        <ScrollView
          contentContainerStyle={styles.rolagem}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
        {/* LOGO */}
        <LinearGradient
          colors={colors.primaryGradient}
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

          {adminSemSenha && (
            <View style={styles.avisoAdmin}>
              <Text style={styles.avisoAdminTitulo}>Primeiro uso deste aparelho</Text>
              <Text style={styles.avisoAdminTexto}>
                O administrador ainda não tem senha. Defina agora para liberar a área de gestão.
              </Text>
              <Button
                title="Configurar administrador"
                variant="ghost"
                onPress={() => router.push('/(auth)/configurar-admin')}
              />
            </View>
          )}

          {/* Só faz sentido depois de o administrador ter senha. */}
          {!adminSemSenha && (
            <Text
              style={styles.linkDiscreto}
              onPress={() => router.push('/(auth)/reiniciar-aparelho')}
              accessibilityRole="link"
            >
              Administrador perdeu a senha e o código?
            </Text>
          )}

          {/* FOOTER LGPD: fixo no fundo do formContainer */}
          <Text style={styles.lgpd}>
            Este sistema está em conformidade com a LGPD (Lei 13.709/2018).
            Os dados coletados são utilizados exclusivamente para fins de saúde pública.
          </Text>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const criarStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  // flexGrow, e não flex: ocupa a tela quando sobra espaço (o rodapé da LGPD
  // continua no fundo) e cresce além dela quando falta, para rolar.
  rolagem: {
    flexGrow: 1,
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
    backgroundColor: colors.surface,
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
    color: colors.onGradient,
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  formContainer: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    // Sem `justifyContent: 'space-between'` aqui.
    //
    // O container e vertical e ocupa o que sobra da tela, entao o
    // `space-between` dividia a folga entre titulo, subtitulo, formulario e
    // rodape. O resultado era um vao grande entre o subtitulo e o campo de
    // CPF, que cresce junto com a altura do aparelho: a mesma tela fica
    // apertada no aparelho pequeno e esparramada no grande.
    //
    // O rodape da LGPD continua no fundo, mas por `marginTop: 'auto'` nele,
    // que empurra so o rodape e deixa o resto do conteudo no espacamento
    // normal.
    //
    // Era o unico `space-between` vertical do aplicativo: os outros 19 sao
    // em linha, onde distribuir e o comportamento desejado.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  formTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: colors.primary,
  },
  formSubtitle: {
    fontSize: FONT_SIZE.xs,
    color: colors.textLight,
    marginBottom: SPACING.sm,
  },
  form: {
    // SPACING.md e o espacamento de formulario das outras duas telas de
    // autenticacao, cadastro e recuperar-senha. Aqui estava SPACING.sm, e
    // telas irmas com espacamento diferente parecem telas de sistemas
    // diferentes.
    gap: SPACING.md,
  },
  avisoAdmin: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: colors.avisoFundo,
    borderWidth: 1,
    borderColor: colors.avisoBorda,
    gap: 4,
  },
  avisoAdminTitulo: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: colors.aviso,
  },
  avisoAdminTexto: {
    fontSize: FONT_SIZE.xs,
    color: colors.textMedium,
  },
  linkDiscreto: {
    fontSize: FONT_SIZE.xs,
    color: colors.textLight,
    textAlign: 'center',
    textDecorationLine: 'underline',
    paddingVertical: SPACING.sm,
  },
  lgpd: {
    fontSize: FONT_SIZE.xs,
    color: colors.placeholder,
    textAlign: 'center',
    paddingTop: SPACING.sm,
    // Empurra so o rodape para o fundo, sem esticar o que vem antes.
    marginTop: 'auto',
  },
});
