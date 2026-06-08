import React, { useState, useEffect, useContext } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { AuthContext } from '../../contexts/AuthContext';
import { theme } from '../../theme/theme';

export default function AgentDashboard({ navigation }) {
  const { user, signOut } = useContext(AuthContext);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchForms();
    });
    return unsubscribe;
  }, [navigation]);

  async function fetchForms() {
    setLoading(true);
    try {
      const response = await api.get('/forms/me');
      setForms(response.data);
    } catch (error) {
      console.error('Erro ao buscar formulários:', error);
    } finally {
      setLoading(false);
    }
  }

  const renderFormCard = ({ item }) => {
    const date = new Date(item.dataVisita).toLocaleDateString('pt-BR');
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.paciente}</Text>
          <Text style={styles.cardDate}>{date}</Text>
        </View>
        <Text style={styles.cardText}>Endereço: {item.endereco}</Text>
        {item.observacoes && <Text style={styles.cardTextObs}>Obs: {item.observacoes}</Text>}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Bem-vind@, {user?.nome?.split(' ')[0]}!</Text>
          <Text style={styles.subtitle}>Formulários registrados:</Text>
        </View>
        <TouchableOpacity style={styles.logoBadge}>
          <Ionicons name="document-text-outline" size={32} color={theme.colors.surface} />
        </TouchableOpacity>
      </View>

      <View style={styles.listContainer}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : forms.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={64} color={theme.colors.textLight} />
            <Text style={styles.emptyText}>Nenhum formulário registrado ainda.</Text>
          </View>
        ) : (
          <FlatList
            data={forms}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderFormCard}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.mainActionButton} onPress={() => navigation.navigate('CreateForm')}>
          <Ionicons name="add-circle-outline" size={24} color={theme.colors.surface} style={{ marginRight: 8 }} />
          <Text style={styles.mainActionText}>Preencher Novo Formulário</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutButtonText}>Sair</Text>
        </TouchableOpacity>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  welcomeText: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: '#00D1FF',
  },
  subtitle: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.surface,
    marginTop: 4,
  },
  logoBadge: {
    backgroundColor: theme.colors.accent,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textLight,
    marginTop: theme.spacing.md,
    fontSize: theme.typography.sizes.md,
  },
  card: {
    backgroundColor: '#D1D5E9',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  cardDate: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
  },
  cardText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
  },
  cardTextObs: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.accent,
    marginTop: theme.spacing.xs,
    fontStyle: 'italic',
  },
  actionsContainer: {
    padding: theme.spacing.lg,
    paddingBottom: 30,
  },
  mainActionButton: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    height: 60,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  mainActionText: {
    color: theme.colors.surface,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
  },
  logoutButton: {
    borderWidth: 1.5,
    borderColor: theme.colors.surface,
    borderRadius: theme.borderRadius.round,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: theme.colors.surface,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.medium,
  }
});
