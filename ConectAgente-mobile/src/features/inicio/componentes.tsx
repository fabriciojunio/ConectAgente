import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SyncIndicator } from '../../components/ui/SyncIndicator';
import { useTheme } from '../../contexts/ThemeContext';
import type { Residencia } from '../../types';
import type { EstilosDoInicio } from './estilos';
import { dataPorExtenso, iniciais, saudacao, type ResumoDaMeta } from './regrasDoInicio';

interface CabecalhoProps {
  styles: EstilosDoInicio;
  nome: string;
  unidade?: string | null;
  fotoUri: string | null;
  meta: ResumoDaMeta;
  onFoto: () => void;
  onSair: () => void;
}

/** Saudação, avatar, unidade e a meta do mês, sobre o gradiente. */
export function CabecalhoDoInicio({ styles, nome, unidade, fotoUri, meta, onFoto, onSair }: CabecalhoProps) {
  const { colors } = useTheme();
  const agora = new Date();

  return (
    <LinearGradient colors={colors.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
      <View style={styles.headerTop}>
        <View style={styles.headerLeft}>
          <Text style={styles.saudacao}>{saudacao(agora.getHours())},</Text>
          <Text style={styles.nomeAgente}>{nome.split(' ')[0]}</Text>
          <Text style={styles.dateText} numberOfLines={1}>{dataPorExtenso(agora)}</Text>
        </View>

        <View style={styles.headerActions}>
          <SyncIndicator />
          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={onFoto}
            activeOpacity={0.8}
            accessibilityLabel="Foto de perfil"
          >
            {fotoUri ? (
              <Image source={{ uri: fotoUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{nome ? iniciais(nome) : '?'}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={onSair} hitSlop={8} style={styles.logoutBtn} accessibilityLabel="Sair">
            <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        </View>
      </View>

      {unidade ? (
        <View style={styles.unidadeChip}>
          <Ionicons name="medical-outline" size={12} color="rgba(255,255,255,0.9)" />
          <Text style={styles.unidadeText} numberOfLines={1}>{unidade}</Text>
        </View>
      ) : null}

      <View style={styles.metaCard}>
        <View style={styles.metaHeader}>
          <Text style={styles.metaTitle}>Meta mensal</Text>
          <Text style={styles.metaPercent}>{meta.temMeta ? `${meta.percentual}%` : 'sem meta'}</Text>
        </View>
        {meta.temMeta && (
          <View style={styles.metaBarBg}>
            <View style={[styles.metaBarFill, { width: `${meta.percentual}%` }]} />
          </View>
        )}
        <Text style={styles.metaSubtext}>{meta.texto}</Text>
      </View>
    </LinearGradient>
  );
}

interface LinhaProps {
  styles: EstilosDoInicio;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: number;
  divider?: boolean;
}

/** Linha de um cartão de resumo: ícone, rótulo e número. */
export function LinhaDoResumo({ styles, icon, iconColor, label, value, divider = true }: LinhaProps) {
  return (
    <View style={[styles.linha, divider && styles.linhaComDivisor]}>
      <View style={[styles.linhaIcone, { backgroundColor: iconColor + '18' }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={styles.linhaRotulo}>{label}</Text>
      <Text style={styles.linhaValor}>{value}</Text>
    </View>
  );
}

interface ResidenciaRecenteProps {
  styles: EstilosDoInicio;
  residencia: Residencia;
  onPress: () => void;
}

/** Atalho para uma residência cadastrada há pouco. */
export function ResidenciaRecente({ styles, residencia, onPress }: ResidenciaRecenteProps) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={styles.recentCard}>
      <View style={styles.recentIcon}>
        <Ionicons name="home-outline" size={18} color={colors.primary} />
      </View>
      <View style={styles.recentTexto}>
        <Text style={styles.recentTitle} numberOfLines={1}>{residencia.logradouro}, {residencia.numero}</Text>
        <Text style={styles.recentSub} numberOfLines={1}>
          {residencia.bairro} • {residencia.cidade}/{residencia.estado}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
    </TouchableOpacity>
  );
}
