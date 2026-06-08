import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { AuthContext } from '../../contexts/AuthContext';
import { theme } from '../../theme/theme';
import DeleteModal from '../../components/DeleteModal';

export default function AdminDashboard({ navigation }) {
  const { signOut } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchUsers();
    });
    return unsubscribe;
  }, [navigation]);

  async function fetchUsers() {
    setLoading(true);
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!userToDelete) return;
    try {
      await api.delete(`/users/${userToDelete.id}`);
      setUsers(users.filter(u => u.id !== userToDelete.id));
    } catch (error) {
      console.error(error);
    } finally {
      setDeleteModalVisible(false);
      setUserToDelete(null);
    }
  }

  function confirmDelete(user) {
    setUserToDelete(user);
    setDeleteModalVisible(true);
  }

  const filteredUsers = users.filter(u => u.nome.toLowerCase().includes(search.toLowerCase()) || u.login.toLowerCase().includes(search.toLowerCase()));

  const renderUserCard = ({ item }) => (
    <View style={styles.card}>
      <TouchableOpacity style={styles.deleteIcon} onPress={() => confirmDelete(item)}>
        <Ionicons name="trash-outline" size={32} color={theme.colors.text} />
      </TouchableOpacity>
      <View style={{flex:1, justifyContent:'center'}}>
        <Text style={styles.cardName}>{item.nome}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <DeleteModal 
        visible={deleteModalVisible} 
        onCancel={() => setDeleteModalVisible(false)} 
        onConfirm={handleDeleteConfirm}
        userName={userToDelete?.nome}
      />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Bem-vind@, ADM!</Text>
          <Text style={styles.subtitle}>O que faremos hoje?</Text>
        </View>
        <TouchableOpacity style={styles.logoBadge}>
          <Ionicons name="people-outline" size={32} color={theme.colors.surface} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.text} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Pesquisar"
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={theme.colors.text}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.listContainer}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderUserCard}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={true}
          />
        )}
      </View>

      <View style={styles.actionsContainer}>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('EditUser', { mode: 'create' })}>
            <Text style={styles.actionButtonText}>Cadastrar novo{'\n'}usuário</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('EditUser', { mode: 'edit', users })}>
            <Text style={styles.actionButtonText}>Editar um{'\n'}usuário</Text>
          </TouchableOpacity>
        </View>
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
    backgroundColor: theme.colors.text, // Dark Blue #000E45
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
    color: '#00D1FF', // Cyan accent from mockup
  },
  subtitle: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.surface,
  },
  logoBadge: {
    backgroundColor: theme.colors.accent,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    height: 40,
    marginBottom: theme.spacing.lg,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: theme.colors.text,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#D1D5E9', // Light gray/blue from mockup card
    borderRadius: theme.borderRadius.md,
    height: 70,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  deleteIcon: {
    marginRight: theme.spacing.md,
  },
  cardName: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.text,
  },
  actionsContainer: {
    padding: theme.spacing.lg,
    paddingBottom: 30, // SafeArea padding
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  actionButton: {
    backgroundColor: '#D1D5E9',
    flex: 0.48,
    height: 80,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    color: theme.colors.text,
    textAlign: 'center',
    fontSize: theme.typography.sizes.md,
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
