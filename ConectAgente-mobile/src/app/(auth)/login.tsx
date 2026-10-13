import React, { useEffect, useMemo, useState } from 'react';
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
import { SPACING, FONT_SIZE, RADIUS } from '../../utils/constants';
import { ADMIN_CPF, agenteRepository } from '../../database/repositories/agenteRepository';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';

export default function Login() {
  const { colors } = useTheme();
  const styles = useMemo(() => criarStyles(colors), [colors]);
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const insets = useSafeAreaInsets();

  /**
   * Credencial inicial do administrador, mostrada uma unica vez.
   *
   * Por que ela precisa aparecer aqui. A conta de administrador e criada na
   * primeira execucao com senha sorteada, guardada no cofre do sistema. Quem
   * le essa senha e a tela de configuracoes, que fica dentro da area
   * administrativa, e so se entra la com a conta de administrador. Numa
   * instalacao nova ninguem entrava: para ver a senha era preciso ja estar
   * dentro, e para entrar era preciso a senha.
   *
   * O aviso some sozinho: `esquecerSenhaInicialDoAdmin` apaga a chave quando
   * a senha e trocada, e `obterSenhaInicialDoAdmin` passa a devolver nulo.
   *
   * O que isso custa: quem tiver o aparelho em maos antes da primeira troca
   * ve a senha. E uma conta local, que manda no SQLite daquele aparelho e nao
   * no servidor, onde quem decide e o RLS com a sessao do Supabase. Entre
   * expor uma credencial local ate a primeira troca e deixar a area
   * administrativa inalcancavel para sempre, o primeiro e o mal menor, e o
   * texto pede a troca.
   */
  const [senhaInicialAdmin, setSenhaInicialAdmin] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    agenteRepository
      .obterSenhaInicialDoAdmin()
      .then((senha) => {
        if (vivo) setSenhaInicialAdmin(senha);
      })
      .catch(() => {
        // Cofre indisponivel nao pode derrubar a tela de login.
      });
    return () => {
      vivo = false;
    };
  }, []);

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

          {senhaInicialAdmin && (
            <View style={styles.avisoAdmin}>
              <Text style={styles.avisoAdminTitulo}>Primeiro acesso do administrador</Text>
              <Text style={styles.avisoAdminTexto}>
                CPF {formatCPF(ADMIN_CPF)}, senha {senhaInicialAdmin}
              </Text>
              <Text style={styles.avisoAdminTexto}>
                Troque a senha no primeiro acesso. Este aviso some quando ela for trocada.
              </Text>
            </View>
          )}

          {/* FOOTER LGPD: fixo no fundo do formContainer */}
          <Text style={styles.lgpd}>
            Este sistema está em conformidade com a LGPD (Lei 13.709/2018).
            Os dados coletados são utilizados exclusivamente para fins de saúde pública.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const criarStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
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
    backgroundColor: colors.white,
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
    color: colors.white,
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  formContainer: {
    flex: 1,
    backgroundColor: colors.white,
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
  lgpd: {
    fontSize: FONT_SIZE.xs,
    color: colors.placeholder,
    textAlign: 'center',
    paddingTop: SPACING.sm,
    // Empurra so o rodape para o fundo, sem esticar o que vem antes.
    marginTop: 'auto',
  },
});
