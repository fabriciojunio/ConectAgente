import React, { useMemo } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Card } from '../../components/ui/Card';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { StatCard } from '../../components/ui/StatCard';
import { QuickAction } from '../../components/ui/QuickAction';
import { useFotoDePerfil } from '../../features/perfil/useFotoDePerfil';
import { useResumoDoInicio } from '../../features/inicio/useResumoDoInicio';
import { resumoDaMeta } from '../../features/inicio/regrasDoInicio';
import { criarEstilosDoInicio } from '../../features/inicio/estilos';
import { CabecalhoDoInicio, LinhaDoResumo, ResidenciaRecente } from '../../features/inicio/componentes';

/** Início do agente: meta do mês, números da área e atalhos para o trabalho de campo. */
export default function Inicio() {
  const { colors } = useTheme();
  const styles = useMemo(() => criarEstilosDoInicio(colors), [colors]);
  const { agente, logout } = useAuth();
  const foto = useFotoDePerfil();
  const resumo = useResumoDoInicio(agente?.id);
  const { stats } = resumo;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={resumo.atualizando}
            onRefresh={resumo.atualizar}
            tintColor={colors.primaryLight}
            colors={[colors.primary]}
          />
        }
      >
        <CabecalhoDoInicio
          styles={styles}
          nome={agente?.nome ?? ''}
          unidade={agente?.unidade_saude}
          fotoUri={foto.uri}
          meta={resumoDaMeta(stats)}
          onFoto={foto.escolher}
          onSair={logout}
        />

        <View style={styles.statsRow}>
          <StatCard icon="today-outline" label="Hoje" value={stats?.realizadas_hoje ?? 0}
            accent={colors.primary} onPress={() => router.push('/(app)/visitas')} />
          <StatCard icon="calendar-outline" label="Semana" value={stats?.realizadas_semana ?? 0}
            accent={colors.info} onPress={() => router.push('/(app)/visitas')} />
          <StatCard icon="time-outline" label="Agendadas" value={stats?.total_agendadas ?? 0}
            accent={colors.warning} onPress={() => router.push('/(app)/calendario')} />
          <StatCard icon="people-outline" label="Pacientes" value={resumo.totalMoradores}
            accent={colors.success} onPress={() => router.push('/(app)/residencias')} />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Ações rápidas" />
          <View style={styles.actionsGrid}>
            <QuickAction style={styles.quickAction} icon="add-circle-outline" label="Nova visita"
              color={colors.primary} onPress={() => router.push('/(app)/visita/nova')} />
            <QuickAction style={styles.quickAction} icon="home-outline" label="Nova residência"
              color={colors.info} onPress={() => router.push('/(app)/residencia/nova')} />
            <QuickAction style={styles.quickAction} icon="person-add-outline" label="Novo morador"
              color={colors.secondary} onPress={() => router.push('/(app)/morador/novo')} />
            <QuickAction style={styles.quickAction} icon="search-outline" label="Buscar"
              color={colors.warning} onPress={() => router.push('/(app)/busca')} />
            <QuickAction style={styles.quickAction} icon="document-text-outline" label="Relatórios"
              color={colors.success} onPress={() => router.push('/(app)/relatorios')} />
            <QuickAction style={styles.quickAction} icon="bar-chart-outline" label="Metas"
              color="#7B1FA2" onPress={() => router.push('/(app)/metas')} />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Resumo da área" />
          <Card variant="default" padding="md">
            <LinhaDoResumo styles={styles} icon="business-outline" iconColor={colors.info}
              label="Residências cadastradas" value={resumo.totalResidencias} />
            <LinhaDoResumo styles={styles} icon="people-outline" iconColor={colors.success}
              label="Moradores cadastrados" value={resumo.totalMoradores} divider={false} />
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Visitas" action={{ label: 'Ver todas', onPress: () => router.push('/(app)/visitas') }} />
          <Card variant="default" padding="md">
            <LinhaDoResumo styles={styles} icon="checkmark-circle-outline" iconColor={colors.success}
              label="Realizadas este mês" value={stats?.realizadas_mes ?? 0} />
            <LinhaDoResumo styles={styles} icon="ellipse-outline" iconColor={colors.warning}
              label="Pendentes / agendadas" value={stats?.total_agendadas ?? 0} />
            <LinhaDoResumo styles={styles} icon="trending-up-outline" iconColor={colors.primary}
              label="Total geral" value={stats?.total_realizadas ?? 0} divider={false} />
          </Card>
        </View>

        {resumo.residenciasRecentes.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Residências recentes"
              action={{ label: 'Ver todas', onPress: () => router.push('/(app)/residencias') }}
            />
            {resumo.residenciasRecentes.map((residencia) => (
              <ResidenciaRecente
                key={residencia.id}
                styles={styles}
                residencia={residencia}
                onPress={() => router.push({ pathname: '/(app)/residencia/[id]', params: { id: residencia.id } })}
              />
            ))}
          </View>
        )}

        <View style={styles.fimDaPagina} />
      </ScrollView>
    </SafeAreaView>
  );
}
