import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { theme } from '../../theme/theme';

export default function EditUserScreen({ route, navigation }) {
  const { mode, users } = route.params; // mode = 'create' or 'edit'
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [nome, setNome] = useState('');
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  // When editing, if a user is selected:
  function handleSelectUser(user) {
    setSelectedUser(user);
    setNome(user.nome);
    setLogin(user.login);
    setIsAdmin(user.role === 'ADMIN');
    setSenha('');
  }

  async function handleSave() {
    if (!nome || !login || (mode === 'create' && !senha)) {
      Alert.alert('Erro', 'Preencha os campos obrigatórios.');
      return;
    }

    setLoading(true);
    const data = { nome, login, role: isAdmin ? 'ADMIN' : 'AGENTE' };
    if (senha) data.senha = senha;

    try {
      if (mode === 'create') {
        await api.post('/users', data);
        Alert.alert('Sucesso', 'Usuário criado com sucesso!');
        navigation.goBack();
      } else {
        if (!selectedUser) {
          Alert.alert('Erro', 'Selecione um usuário para editar.');
          return;
        }
        await api.put(`/users/${selectedUser.id}`, data);
        Alert.alert('Sucesso', 'Usuário editado com sucesso!');
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao salvar o usuário.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.surface} />
        </TouchableOpacity>
        <Text style={styles.title}>{mode === 'create' ? 'Novo Usuário' : 'Editar Usuário'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.formContainer}>
        {mode === 'edit' && !selectedUser && (
          <View style={styles.userListContainer}>
            <Text style={styles.subtitle}>Selecione um usuário para editar:</Text>
            {users?.map(u => (
              <TouchableOpacity key={u.id} style={styles.userItem} onPress={() => handleSelectUser(u)}>
                <Text style={styles.userItemText}>{u.nome}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {((mode === 'edit' && selectedUser) || mode === 'create') && (
          <View style={styles.inputs}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={styles.input}
              value={nome}
              onChangeText={setNome}
              placeholderTextColor={theme.colors.textLight}
            />
            
            <Text style={styles.label}>Login (E-mail ou CPF)</Text>
            <TextInput
              style={styles.input}
              value={login}
              onChangeText={setLogin}
              autoCapitalize="none"
              placeholderTextColor={theme.colors.textLight}
            />

            <Text style={styles.label}>Senha {mode === 'edit' && '(Deixe em branco para não alterar)'}</Text>
            <TextInput
              style={styles.input}
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
              placeholderTextColor={theme.colors.textLight}
            />

            <View style={styles.switchContainer}>
              <Text style={styles.labelSwitch}>O usuário é um Administrador?</Text>
              <Switch
                value={isAdmin}
                onValueChange={setIsAdmin}
                trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
              />
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color={theme.colors.text} /> : <Text style={styles.saveButtonText}>Salvar</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
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
    marginTop: theme.spacing.md,
  },
  userListContainer: {
    marginTop: theme.spacing.md,
  },
  subtitle: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    fontWeight: theme.typography.weights.medium,
  },
  userItem: {
    padding: theme.spacing.md,
    backgroundColor: '#F0F2FA',
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  userItemText: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.md,
  },
  inputs: {
    marginTop: theme.spacing.lg,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
    fontWeight: theme.typography.weights.medium,
  },
  input: {
    backgroundColor: '#F0F2FA',
    height: 50,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    color: theme.colors.text,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.sm,
  },
  labelSwitch: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
  },
  saveButton: {
    backgroundColor: theme.colors.accent,
    height: 55,
    borderRadius: theme.borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: theme.colors.surface,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
  }
});
