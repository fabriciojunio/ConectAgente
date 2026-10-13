import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';

interface ProgressBarProps {
  valor: number;
  meta: number;
  label?: string;
  cor?: string;
}

/**
 * Barra de progresso de meta.
 *
 * Duas coisas estavam erradas aqui.
 *
 * As cores eram da paleta clara, escritas à mão: trilho cinza claro e texto
 * cinza escuro. No tema escuro a barra ficava um retângulo claro no meio do
 * cartão, com a legenda quase invisível.
 *
 * E a conta não se protegia de meta zero. `(valor / meta) * 100` com meta 0
 * dá `Infinity`, e `Math.min(100, Infinity)` é 100: um agente sem meta
 * cadastrada via a barra cheia, como se tivesse cumprido tudo. Com valor e
 * meta zerados dá `NaN`, e a largura saía como `NaN%`, que o React Native
 * descarta sem reclamar. Agente sem meta é o caso comum, porque a meta vem da
 * coordenação e pode demorar a chegar.
 */
export function ProgressBar({ valor, meta, label, cor }: ProgressBarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => criarEstilos(colors), [colors]);

  const temMeta = meta > 0;
  const pct = temMeta ? Math.min(100, (valor / meta) * 100) : 0;

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${pct}%` as `${number}%`, backgroundColor: cor ?? colors.success },
          ]}
        />
      </View>
      <Text style={styles.legenda}>
        {temMeta
          ? `${valor} / ${meta} (${pct.toFixed(0)}%)`
          : `${valor} sem meta definida`}
      </Text>
    </View>
  );
}

const criarEstilos = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { marginVertical: 4 },
    label: { fontSize: 13, color: colors.textMedium, marginBottom: 4, fontWeight: '500' },
    track: { height: 8, backgroundColor: colors.borderLight, borderRadius: 4, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 4 },
    legenda: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  });
