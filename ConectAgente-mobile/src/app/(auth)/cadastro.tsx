import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { FormField } from '../../components/forms/FormField';
import { SelectField } from '../../components/forms/SelectField';
import { Button } from '../../components/button';
import { PageHeader } from '../../components/ui/PageHeader';
import { formatCPF, stripCPF } from '../../utils/formatters';
import { validarCPF } from '../../utils/validators';
import { COLORS, SPACING, FONT_SIZE, VALIDATION } from '../../utils/constants';

const cadastroSchema = z.object({
  nome: z.string().min(3, 'Nome obrigatório (mín. 3 caracteres)'),
  cpf: z.string().refine((v) => validarCPF(v), 'CPF inválido'),
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(VALIDATION.SENHA_MIN_LENGTH, `Mínimo ${VALIDATION.SENHA_MIN_LENGTH} caracteres`),
  confirmar_senha: z.string(),
  area_atuacao: z.string().min(2, 'Área de atuação obrigatória'),
  unidade_saude: z.string().min(2, 'Unidade de saúde obrigatória'),
}).refine((d) => d.senha === d.confirmar_senha, {
  path: ['confirmar_senha'],
  message: 'As senhas não coincidem',
});

type CadastroFormData = z.infer<typeof cadastroSchema>;

export default function Cadastro() {
  const { registrar } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const { control, handleSubmit } = useForm<CadastroFormData>({
    resolver: zodResolver(cadastroSchema),
  });

  async function onSubmit(data: CadastroFormData) {
    setIsLoading(true);
    try {
      await registrar({
        nome: data.nome,
        cpf: stripCPF(data.cpf),
        email: data.email,
        senha: data.senha,
        area_atuacao: data.area_atuacao,
        unidade_saude: data.unidade_saude,
      });
      router.replace('/(app)');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao cadastrar';
      Alert.alert('Erro', msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader title="Primeiro Acesso" showBack />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.description}>
            Cadastre-se para acessar o sistema. Somente Agentes Comunitários de Saúde autorizados
            pela Secretaria de Saúde devem se cadastrar.
          </Text>

          <View style={styles.form}>
            <FormField control={control} name="nome" label="Nome completo" placeholder="Seu nome" required />
            <FormField control={control} name="cpf" label="CPF" placeholder="000.000.000-00" keyboardType="numeric" mask={formatCPF} required />
            <FormField control={control} name="email" label="E-mail" placeholder="email@exemplo.com" keyboardType="email-address" autoCapitalize="none" required />
            <FormField control={control} name="area_atuacao" label="Área de atuação (microárea/setor)" placeholder="Ex: Microárea 03" required />
            <FormField control={control} name="unidade_saude" label="Unidade de saúde" placeholder="Ex: UBS Centro" required />
            <FormField control={control} name="senha" label="Senha" placeholder="Mínimo 8 caracteres" secureTextEntry required />
            <FormField control={control} name="confirmar_senha" label="Confirmar senha" placeholder="Repita a senha" secureTextEntry required />

            <Button title="Cadastrar e entrar" onPress={handleSubmit(onSubmit)} loading={isLoading} />
          </View>

          <Text style={styles.lgpd}>
            Ao se cadastrar, você concorda com o tratamento de dados previsto na LGPD (Lei 13.709/2018)
            para fins exclusivos de atenção básica à saúde pública.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, gap: SPACING.md },
  description: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textLight,
    backgroundColor: COLORS.infoLight,
    padding: SPACING.md,
    borderRadius: 8,
    lineHeight: 22,
  },
  form: { gap: SPACING.md },
  lgpd: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.placeholder,
    textAlign: 'center',
    paddingVertical: SPACING.md,
    lineHeight: 18,
  },
});
