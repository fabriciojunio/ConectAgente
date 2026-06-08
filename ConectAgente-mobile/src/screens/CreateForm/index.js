import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { theme } from '../../theme/theme';

export default function CreateFormScreen({ navigation }) {
  const [paciente, setPaciente] = useState('');
  const [endereco, setEndereco] = useState('');
  const [dataVisita, setDataVisita] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!paciente || !endereco || !dataVisita) {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios (Paciente, Endereço e Data).');
      return;
    }

    // Basic date parsing assuming DD/MM/YYYY
    let isoDate;
    try {
      const [day, month, year] = dataVisita.split('/');
      isoDate = new Date(`${year}-${month}-${day}T12:00:00Z`).toISOString();
    } catch (e) {
      Alert.alert('Erro', 'Formato de data inválido. Use DD/MM/AAAA.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/forms', {
        paciente,
        endereco,
        dataVisita: isoDate,
        observacoes
      });
      Alert.alert('Sucesso', 'Formulário enviado com sucesso!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um problema ao enviar o formulário.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.surface} />
          </TouchableOpacity>
          <Text style={styles.title}>Novo Formulário</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.formContainer} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.inputs}>
            <Text style={styles.label}>Nome do Paciente *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color={theme.colors.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={paciente}
                onChangeText={setPaciente}
                placeholder="Ex: João da Silva"
                placeholderTextColor={theme.colors.textLight}
              />
            </View>
            
            <Text style={styles.label}>Endereço da Visita *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="home-outline" size={20} color={theme.colors.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={endereco}
                onChangeText={setEndereco}
                placeholder="Ex: Rua das Flores, 123"
                placeholderTextColor={theme.colors.textLight}
              />
            </View>

            <Text style={styles.label}>Data da Visita *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={dataVisita}
                onChangeText={setDataVisita}
                placeholder="DD/MM/AAAA"
                keyboardType="numeric"
                maxLength={10}
                placeholderTextColor={theme.colors.textLight}
              />
            </View>

            <Text style={styles.label}>Observações (Opcional)</Text>
            <View style={[styles.inputWrapper, { height: 100, alignItems: 'flex-start', paddingTop: 10 }]}>
              <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                value={observacoes}
                onChangeText={setObservacoes}
                placeholder="Detalhes ou sintomas notáveis..."
                placeholderTextColor={theme.colors.textLight}
                multiline
              />
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
              {loading ? (
                <ActivityIndicator color={theme.colors.surface} />
              ) : (
                <>
                  <Ionicons name="send-outline" size={20} color={theme.colors.surface} style={{ marginRight: 8 }} />
                  <Text style={styles.submitButtonText}>Enviar Dados</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.text,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    color: theme.colors.surface,
    fontWeight: theme.typography.weights.bold,
  },
  backButton: {
    padding: theme.spacing.xs,
  },
  formContainer: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    marginTop: theme.spacing.md,
  },
  inputs: {
    flex: 1,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
    fontWeight: theme.typography.weights.bold,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2FA',
    minHeight: 55,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: '#E0E5F1',
  },
  inputIcon: {
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.typography.sizes.md,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: theme.colors.accent,
    height: 60,
    borderRadius: theme.borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonText: {
    color: theme.colors.surface,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
  }
});
