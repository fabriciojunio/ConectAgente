import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, ThemeColors } from '../../contexts/ThemeContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { SPACING, FONT_SIZE, RADIUS } from '../../utils/constants';
import { BASE_LEGAL_LGPD } from '../../utils/lgpd';

export default function Mais() {
  const { agente, logout } = useAuth();
  const { colors } = useTheme();
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('profile_photo_uri').then((uri) => { if (uri) setPhotoUri(uri); });
  }, []);

  function confirmarLogout() {
    Alert.alert('Sair', 'Deseja encerrar sua sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <PageHeader title="Mais opções" showSync={false} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* PERFIL */}
        <Card style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryLight, borderColor: colors.borderLight }]}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarText, { color: colors.white }]}>{agente?.nome.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>{agente?.nome}</Text>
            <Text style={[styles.profileRole, { color: colors.textLight }]}>Agente Comunitário de Saúde</Text>
            <Text style={[styles.profileUnit, { color: colors.placeholder }]}>{agente?.unidade_saude}</Text>
          </View>
        </Card>

        {/* AÇÕES */}
        <Card>
          <MenuItem icon="search-outline" label="Buscar paciente" onPress={() => router.push({ pathname: '/(app)/busca', params: { backTo: '/(app)/mais' } })} colors={colors} />
          <MenuItem icon="document-text-outline" label="Relatórios" onPress={() => router.push({ pathname: '/(app)/relatorios', params: { backTo: '/(app)/mais' } })} colors={colors} />
          <MenuItem icon="bar-chart-outline" label="Controle de metas" onPress={() => router.push({ pathname: '/(app)/metas', params: { backTo: '/(app)/mais' } })} colors={colors} />
        </Card>

        {/* LGPD */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Privacidade (LGPD)</Text>
          <Text style={[styles.lgpdText, { color: colors.textLight }]}>
            <Text style={{ fontWeight: '700', color: colors.textMedium }}>Base legal:</Text> {BASE_LEGAL_LGPD.ARTIGO}
          </Text>
          <Text style={[styles.lgpdText, { color: colors.textLight }]}>
            <Text style={{ fontWeight: '700', color: colors.textMedium }}>Finalidade:</Text> {BASE_LEGAL_LGPD.FINALIDADE}
          </Text>
          <Text style={[styles.lgpdText, { color: colors.textLight }]}>
            <Text style={{ fontWeight: '700', color: colors.textMedium }}>DPO:</Text> {BASE_LEGAL_LGPD.DPO_CONTATO}
          </Text>
        </Card>

        {/* VERSÃO */}
        <Card>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Sobre o app</Text>
          <Text style={[styles.versionText, { color: colors.textLight }]}>ConectAgente v1.0.0</Text>
          <Text style={[styles.versionText, { color: colors.textLight }]}>Sistema de Visitas Domiciliares - ACS</Text>
        </Card>

        {/* LOGOUT */}
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: colors.errorLight }]}
          onPress={confirmarLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>Encerrar sessão</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({ icon, label, onPress, colors }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, { borderBottomColor: colors.borderLight }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={[styles.menuLabel, { color: colors.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
  },
  avatarImage: { width: 60, height: 60, borderRadius: 30 },
  avatarText: { fontSize: FONT_SIZE.xxl, fontWeight: '800' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: FONT_SIZE.lg, fontWeight: '700' },
  profileRole: { fontSize: FONT_SIZE.sm },
  profileUnit: { fontSize: FONT_SIZE.xs },
  sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', marginBottom: SPACING.sm },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    borderBottomWidth: 1,
  },
  menuLabel: { flex: 1, fontSize: FONT_SIZE.md },
  lgpdText: { fontSize: FONT_SIZE.sm, marginBottom: 6, lineHeight: 20 },
  versionText: { fontSize: FONT_SIZE.sm },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    borderRadius: RADIUS.md, padding: SPACING.md,
  },
  logoutText: { fontSize: FONT_SIZE.md, fontWeight: '700' },
});
