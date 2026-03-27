import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useVisitas } from '../../hooks/useVisitas';
import { Agendamento } from '../../types';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { formatDate } from '../../utils/formatters';
import { COLORS, SPACING, FONT_SIZE, RADIUS } from '../../utils/constants';

// Configurar locale pt-BR para o calendário
LocaleConfig.locales['pt-BR'] = {
  monthNames: [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ],
  monthNamesShort: ['Jan.', 'Fev.', 'Mar.', 'Abr.', 'Mai.', 'Jun.', 'Jul.', 'Ago.', 'Set.', 'Out.', 'Nov.', 'Dez.'],
  dayNames: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
  dayNamesShort: ['Dom.', 'Seg.', 'Ter.', 'Qua.', 'Qui.', 'Sex.', 'Sáb.'],
};
LocaleConfig.defaultLocale = 'pt-BR';

export default function Calendario() {
  const { datasComAgendamento, agendamentosPorData } = useVisitas();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [markedDates, setMarkedDates] = useState<Record<string, object>>({});
  const [agendamentosDodia, setAgendamentosDodia] = useState<Agendamento[]>([]);

  const carregarDatas = useCallback(async () => {
    const datas = await datasComAgendamento();
    const marked: Record<string, object> = {};
    datas.forEach((data) => {
      marked[data] = {
        marked: true,
        dotColor: COLORS.warning,
      };
    });

    // Marcar dia selecionado
    const hoje = new Date().toISOString().split('T')[0];
    marked[hoje] = {
      ...(marked[hoje] ?? {}),
      today: true,
      todayBackgroundColor: COLORS.infoLight,
      todayTextColor: COLORS.primary,
    };

    if (selectedDate) {
      marked[selectedDate] = {
        ...(marked[selectedDate] ?? {}),
        selected: true,
        selectedColor: COLORS.primary,
      };
    }

    setMarkedDates(marked);
  }, [selectedDate]);

  const carregarAgendamentosDodia = useCallback(async (data: string) => {
    const agend = await agendamentosPorData(data);
    setAgendamentosDodia(agend);
  }, [agendamentosPorData]);

  useEffect(() => {
    carregarDatas();
    carregarAgendamentosDodia(selectedDate);
  }, [selectedDate]);

  function onDayPress(day: { dateString: string }) {
    setSelectedDate(day.dateString);
  }

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader
        title="Agenda de Visitas"
        rightAction={{
          icon: 'add-circle-outline',
          onPress: () => router.push('/(app)/visita/nova'),
        }}
      />

      <Calendar
        current={selectedDate}
        onDayPress={onDayPress}
        markedDates={markedDates}
        theme={{
          backgroundColor: COLORS.white,
          calendarBackground: COLORS.white,
          selectedDayBackgroundColor: COLORS.primary,
          selectedDayTextColor: COLORS.white,
          todayTextColor: COLORS.primary,
          dayTextColor: COLORS.text,
          textDisabledColor: COLORS.placeholder,
          monthTextColor: COLORS.primary,
          arrowColor: COLORS.primary,
          dotColor: COLORS.warning,
          textDayFontWeight: '500',
          textMonthFontWeight: '700',
          textDayHeaderFontWeight: '600',
        }}
      />

      <View style={styles.agendaContainer}>
        <View style={styles.agendaHeader}>
          <Text style={styles.agendaTitle}>
            {selectedDate === new Date().toISOString().split('T')[0]
              ? 'Hoje'
              : formatDate(selectedDate)
            }
          </Text>
          <Text style={styles.agendaCount}>
            {agendamentosDodia.length} agendamento(s)
          </Text>
        </View>

        {agendamentosDodia.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="Sem agendamentos"
            description="Nenhuma visita agendada para este dia"
          />
        ) : (
          <FlatList
            data={agendamentosDodia}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Card style={styles.agendCard}>
                <View style={styles.agendRow}>
                  <View style={styles.agendIcon}>
                    <Ionicons name="time-outline" size={20} color={COLORS.warning} />
                  </View>
                  <View style={styles.agendInfo}>
                    <Text style={styles.agendMotivo}>{item.motivo}</Text>
                    {item.observacoes && (
                      <Text style={styles.agendObs}>{item.observacoes}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => router.push({
                      pathname: '/(app)/visita/nova',
                      params: {
                        residencia_id: item.residencia_id,
                        backTo: '/(app)/calendario',
                      },
                    })}
                    style={styles.realizarBtn}
                  >
                    <Text style={styles.realizarText}>Realizar</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  agendaContainer: { flex: 1, paddingHorizontal: SPACING.md, paddingTop: SPACING.md },
  agendaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  agendaTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text },
  agendaCount: { fontSize: FONT_SIZE.sm, color: COLORS.textLight },
  list: { gap: SPACING.sm, paddingBottom: SPACING.xl },
  agendCard: { gap: 4 },
  agendRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  agendIcon: { width: 36, alignItems: 'center' },
  agendInfo: { flex: 1 },
  agendMotivo: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  agendObs: { fontSize: FONT_SIZE.sm, color: COLORS.textLight },
  realizarBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm, paddingVertical: 6,
  },
  realizarText: { color: COLORS.white, fontSize: FONT_SIZE.sm, fontWeight: '700' },
});
