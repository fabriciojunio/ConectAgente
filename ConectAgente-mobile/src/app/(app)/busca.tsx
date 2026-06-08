import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Morador } from '../../types';
import { moradorRepository } from '../../database/repositories/moradorRepository';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { formatCPF, formatCartaoSUS, calcularIdade, stripCPF } from '../../utils/formatters';
import { validarCPF, validarCartaoSUS } from '../../utils/validators';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../utils/constants';

type SearchMode = 'nome' | 'cpf' | 'sus';

export default function Busca() {
  const { backTo } = useLocalSearchParams<{ backTo?: string }>();
  const { agente } = useAuth();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('nome');
  const [results, setResults] = useState<Morador[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const buscar = useCallback(async () => {
    if (!agente || query.trim().length < 2) return;
    setIsSearching(true);
    setSearched(true);

    try {
      let moradores: Morador[] = [];

      if (mode === 'nome') {
        moradores = await moradorRepository.buscarPorNome(query.trim(), agente.id);
      } else if (mode === 'cpf') {
        const cpfLimpo = stripCPF(query);
        if (validarCPF(cpfLimpo)) {
          const m = await moradorRepository.buscarPorCpf(cpfLimpo, agente.id);
          moradores = m ? [m] : [];
        }
      } else if (mode === 'sus') {
        const susLimpo = query.replace(/\D/g, '');
        if (validarCartaoSUS(susLimpo)) {
          const m = await moradorRepository.buscarPorCartaoSUS(susLimpo, agente.id);
          moradores = m ? [m] : [];
        }
      }

      setResults(moradores);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [agente, query, mode]);

  function getMask(text: string): string {
    if (mode === 'cpf') return formatCPF(text);
    if (mode === 'sus') return formatCartaoSUS(text);
    return text;
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader title="Buscar Paciente" showBack backTo={backTo} />

      {/* MODO DE BUSCA */}
      <View style={styles.modeContainer}>
        {([
          { key: 'nome', label: 'Nome' },
          { key: 'cpf', label: 'CPF' },
          { key: 'sus', label: 'Cartão SUS' },
        ] as { key: SearchMode; label: string }[]).map((m) => (
          <TouchableOpacity
            key={m.key}
            style={[styles.modeBtn, mode === m.key && styles.modeBtnActive]}
            onPress={() => { setMode(m.key); setQuery(''); setResults([]); setSearched(false); }}
          >
            <Text style={[styles.modeBtnText, mode === m.key && styles.modeBtnTextActive]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* INPUT DE BUSCA */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={COLORS.textLight} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={(text) => setQuery(getMask(text))}
          placeholder={
            mode === 'nome' ? 'Digite o nome do paciente...'
            : mode === 'cpf' ? 'Digite o CPF...'
            : 'Digite o número do Cartão SUS...'
          }
          placeholderTextColor={COLORS.placeholder}
          keyboardType={mode === 'nome' ? 'default' : 'numeric'}
          returnKeyType="search"
          onSubmitEditing={buscar}
          autoFocus
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
            <Ionicons name="close-circle" size={20} color={COLORS.textLight} />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={styles.searchBtn} onPress={buscar} disabled={isSearching}>
        {isSearching ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <>
            <Ionicons name="search" size={18} color={COLORS.white} />
            <Text style={styles.searchBtnText}>Buscar</Text>
          </>
        )}
      </TouchableOpacity>

      {/* RESULTADOS */}
      {searched && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="Nenhum paciente encontrado"
              description={`Verifique o ${mode === 'nome' ? 'nome' : mode === 'cpf' ? 'CPF' : 'cartão SUS'} informado`}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push({
                pathname: '/(app)/morador/[id]',
                params: { id: item.id },
              })}
            >
              <Card style={styles.resultCard}>
                <View style={styles.resultRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.nome.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>{item.nome}</Text>
                    <Text style={styles.resultMeta}>
                      {calcularIdade(item.data_nascimento)} anos •{' '}
                      {item.sexo === 'feminino' ? 'Feminino' : item.sexo === 'masculino' ? 'Masculino' : 'Outro'}
                    </Text>
                    {item.cpf && <Text style={styles.resultDoc}>CPF: {formatCPF(item.cpf)}</Text>}
                    {item.cartao_sus && <Text style={styles.resultDoc}>SUS: {formatCartaoSUS(item.cartao_sus)}</Text>}
                    <View style={styles.badges}>
                      {item.tem_doenca && <Badge label="Doenças" variant="error" />}
                      {item.beneficio_bolsa_familia && <Badge label="Bolsa Família" variant="success" />}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  modeContainer: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.md, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  modeBtn: {
    flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.full,
    borderWidth: 1.5, borderColor: COLORS.borderLight, alignItems: 'center',
  },
  modeBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.infoLight },
  modeBtnText: { fontSize: FONT_SIZE.sm, color: COLORS.textLight, fontWeight: '600' },
  modeBtnTextActive: { color: COLORS.primary },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    margin: SPACING.md, backgroundColor: COLORS.white, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm, borderWidth: 1.5, borderColor: COLORS.border, height: 48,
  },
  input: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.text },
  searchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.md, backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    height: 48,
  },
  searchBtnText: { color: COLORS.white, fontSize: FONT_SIZE.md, fontWeight: '700' },
  list: { padding: SPACING.md, gap: SPACING.sm },
  resultCard: {},
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.white },
  resultInfo: { flex: 1 },
  resultName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  resultMeta: { fontSize: FONT_SIZE.sm, color: COLORS.textLight },
  resultDoc: { fontSize: FONT_SIZE.xs, color: COLORS.placeholder },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
});
