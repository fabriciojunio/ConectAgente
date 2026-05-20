import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ProgressBarProps {
  valor: number;
  meta: number;
  label?: string;
  cor?: string;
}

export function ProgressBar({ valor, meta, label, cor = '#16a34a' }: ProgressBarProps) {
  const pct = Math.min(100, (valor / meta) * 100);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` as `${number}%`, backgroundColor: cor }]} />
      </View>
      <Text style={styles.legenda}>
        {valor} / {meta} ({pct.toFixed(0)}%)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 4 },
  label: { fontSize: 13, color: '#374151', marginBottom: 4, fontWeight: '500' },
  track: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  legenda: { fontSize: 11, color: '#6b7280', marginTop: 2 },
});
