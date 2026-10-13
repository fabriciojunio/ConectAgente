import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FONT_SIZE, SPACING } from '../../utils/constants';
import { useTheme } from '../../contexts/ThemeContext';
import { SyncIndicator } from './SyncIndicator';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backTo?: string;
  showSync?: boolean;
  rightAction?: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; label?: string };
}

export function PageHeader({
  title, subtitle, showBack = false, backTo, showSync = false, rightAction,
}: PageHeaderProps) {
  // O cabecalho ficava branco no modo escuro, em todas as 16 telas que o usam,
  // porque lia a paleta fixa em vez do tema.
  const { colors } = useTheme();

  function handleBack() {
    if (backTo) {
      router.push(backTo as any);
    } else {
      router.back();
    }
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderBottomColor: colors.borderLight,
          shadowColor: colors.cardShadow,
        },
      ]}
    >
      <View style={styles.row}>
        {showBack && (
          <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={8}>
            <View style={[styles.backCircle, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.textLight }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        <View style={styles.actions}>
          {showSync && <SyncIndicator />}
          {rightAction && (
            <TouchableOpacity onPress={rightAction.onPress} style={styles.actionButton} hitSlop={8}>
              <View style={[styles.actionCircle, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name={rightAction.icon} size={20} color={colors.primary} />
              </View>
              {rightAction.label && (
                <Text style={[styles.actionLabel, { color: colors.primary }]}>{rightAction.label}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 40,
  },
  backButton: {
    marginRight: 2,
  },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
});
