import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native';
import { AuthContext } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { theme } from '../../theme/theme';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const { signIn } = useContext(AuthContext);
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  const [nome, setNome] = useState('');
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAction() {
    if (isLoginMode) {
      if (!login || !senha) {
        Alert.alert('Erro', 'Preencha todos os campos!');
        return;
      }
      setLoading(true);
      try {
        await signIn({ login, senha });
      } catch (error) {
        Alert.alert('Erro', 'Usuário ou senha inválidos.');
        setLoading(false);
      }
    } else {
      // Register Mode
      if (!nome || !login || !senha) {
        Alert.alert('Erro', 'Preencha todos os campos para cadastrar!');
        return;
      }
      setLoading(true);
      try {
        // Send to the setup route (we'll create it as an ADMIN to give you full access)
        await api.post('/auth/setup', { nome, login, senha });
        Alert.alert('Sucesso', 'Conta de Administrador criada! Faça login agora.');
        setIsLoginMode(true);
        // Clear name, leave login/senha for easy sign in
        setNome('');
      } catch (error) {
        Alert.alert('Erro', 'Falha ao criar a conta. Tente outro login.');
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.logoContainer}>
          <View style={styles.iconBackground}>
            <Ionicons name="people-circle-outline" size={100} color={theme.colors.surface} />
          </View>
          <Text style={styles.logoText}>Connect</Text>
          <Text style={styles.logoTextSub}>Agente</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>{isLoginMode ? 'Bem-vindo de volta!' : 'Crie sua conta Admin'}</Text>
          
          {!isLoginMode && (
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={theme.colors.textLight} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Nome Completo"
                placeholderTextColor={theme.colors.textLight}
                value={nome}
                onChangeText={setNome}
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color={theme.colors.textLight} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Login ou E-mail"
              placeholderTextColor={theme.colors.textLight}
              value={login}
              onChangeText={setLogin}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textLight} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="Senha"
              placeholderTextColor={theme.colors.textLight}
              secureTextEntry
              value={senha}
              onChangeText={setSenha}
            />
          </View>

          {isLoginMode && (
            <TouchableOpacity style={styles.forgotPasswordContainer}>
              <Text style={styles.forgotPassword}>Esqueceu a senha?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.button} onPress={handleAction} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={theme.colors.surface} />
            ) : (
              <Text style={styles.buttonText}>{isLoginMode ? 'Entrar' : 'Cadastrar'}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.switchModeContainer}>
            <Text style={styles.switchModeText}>
              {isLoginMode ? 'Ainda não tem conta?' : 'Já tem uma conta?'}
            </Text>
            <TouchableOpacity onPress={() => setIsLoginMode(!isLoginMode)}>
              <Text style={styles.switchModeAction}>
                {isLoginMode ? ' Criar Admin' : ' Fazer Login'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.textLight, 
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 60,
  },
  iconBackground: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  logoText: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  logoTextSub: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginTop: -8,
  },
  formContainer: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    alignItems: 'center',
    paddingBottom: 60,
    flex: 1,
  },
  formTitle: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.bold,
    marginBottom: theme.spacing.lg,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 55,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.round,
    borderColor: theme.colors.text,
    borderWidth: 1.5,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  icon: {
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: theme.spacing.lg,
  },
  forgotPassword: {
    color: theme.colors.textLight,
    fontSize: theme.typography.sizes.sm,
  },
  button: {
    width: '100%',
    height: 55,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.borderRadius.round,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    marginTop: theme.spacing.md,
  },
  buttonText: {
    color: theme.colors.surface,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
  },
  switchModeContainer: {
    flexDirection: 'row',
    marginTop: theme.spacing.xl,
  },
  switchModeText: {
    color: theme.colors.textLight,
    fontSize: theme.typography.sizes.md,
  },
  switchModeAction: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
  }
});
