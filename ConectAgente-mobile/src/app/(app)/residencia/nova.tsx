import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, Text,
} from 'react-native';
import { router } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useResidencias } from '../../../hooks/useResidencias';
import { FormField } from '../../../components/forms/FormField';
import { SelectField } from '../../../components/forms/SelectField';
import { SwitchField } from '../../../components/forms/SwitchField';
import { Button } from '../../../components/button';
import { PageHeader } from '../../../components/ui/PageHeader';
import { cepService } from '../../../services/cepService';
import { residenciaSchema, ResidenciaFormDataValidated } from '../../../utils/validators';
import { formatCEP, stripCEP } from '../../../utils/formatters';
import { TIPO_IMOVEL_OPTIONS, ESTADOS_BRASIL, COLORS, SPACING, FONT_SIZE } from '../../../utils/constants';

export default function NovaResidencia() {
  const { criar } = useResidencias();
  const [isLoading, setIsLoading] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const { control, handleSubmit, setValue, watch } = useForm<ResidenciaFormDataValidated>({
    resolver: zodResolver(residenciaSchema),
    mode: 'onBlur',
    defaultValues: {
      tem_animais: false,
      num_comodos: 1,
      tipo_imovel: 'proprio',
      estado: 'SP',
    },
  });

  const temAnimais = watch('tem_animais');

  async function buscarCEP(cep: string) {
    const cepLimpo = stripCEP(cep);
    if (cepLimpo.length !== 8) return;

    setBuscandoCep(true);
    const endereco = await cepService.buscarSeguro(cepLimpo);
    if (endereco) {
      setValue('logradouro', endereco.logradouro);
      setValue('bairro', endereco.bairro);
      setValue('cidade', endereco.localidade);
      setValue('estado', endereco.uf);
    }
    setBuscandoCep(false);
  }

  async function onSubmit(data: ResidenciaFormDataValidated) {
    setIsLoading(true);
    try {
      const residencia = await criar({
        ...data,
        cep: stripCEP(data.cep),
        num_comodos: Number(data.num_comodos),
      });
      router.replace({
        pathname: '/(app)/residencia/[id]',
        params: { id: residencia.id },
      });
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Erro ao cadastrar');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader title="Nova Residência" showBack />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <Text style={styles.sectionTitle}>Endereço</Text>

          <FormField
            control={control} name="cep" label="CEP" required
            placeholder="00000-000" keyboardType="numeric"
            mask={formatCEP}
            rightElement={
              buscandoCep
                ? <Ionicons name="sync" size={20} color={COLORS.textLight} />
                : <TouchableOpacity onPress={() => buscarCEP(watch('cep'))}>
                    <Ionicons name="search-outline" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
            }
            onEndEditing={(e) => buscarCEP(e.nativeEvent.text)}
          />

          <FormField control={control} name="logradouro" label="Logradouro" placeholder="Rua, Avenida..." required />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <FormField control={control} name="numero" label="Número" placeholder="Nº" keyboardType="numeric" required />
            </View>
            <View style={{ flex: 2 }}>
              <FormField control={control} name="complemento" label="Complemento" placeholder="Apto, Casa..." />
            </View>
          </View>
          <FormField control={control} name="bairro" label="Bairro" placeholder="Bairro" required />
          <View style={styles.row}>
            <View style={{ flex: 3 }}>
              <FormField control={control} name="cidade" label="Cidade" placeholder="Cidade" required />
            </View>
            <View style={{ flex: 1 }}>
              <SelectField
                control={control} name="estado" label="UF" required
                options={ESTADOS_BRASIL.map((e) => ({ label: e, value: e }))}
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Informações da moradia</Text>

          <SelectField
            control={control} name="tipo_imovel" label="Tipo de imóvel" required
            options={TIPO_IMOVEL_OPTIONS}
          />

          <FormField
            control={control} name="num_comodos" label="Número de cômodos" required
            placeholder="Ex: 4" keyboardType="numeric"
          />

          <SwitchField
            control={control} name="tem_animais" label="Possui animais de estimação?"
          />

          {temAnimais && (
            <FormField
              control={control} name="animais_info" label="Quais animais e quantos?"
              placeholder="Ex: 2 cães, 1 gato"
              multiline numberOfLines={2}
            />
          )}

          <Button
            title="Cadastrar residência"
            onPress={handleSubmit(onSubmit, (erros) => {
              const msgs = Object.values(erros).map((e) => `• ${e?.message}`).filter(Boolean);
              Alert.alert('Corrija os campos', msgs.length ? msgs.join('\n') : 'Verifique os campos obrigatórios');
            })}
            loading={isLoading}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },
  sectionTitle: {
    fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.primary,
    marginTop: SPACING.sm,
  },
  row: { flexDirection: 'row', gap: SPACING.sm },
});
