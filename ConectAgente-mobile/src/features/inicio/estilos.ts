import { StyleSheet, Platform } from 'react-native';
import { FONT_SIZE, RADIUS, SPACING } from '../../utils/constants';
import type { ThemeColors } from '../../contexts/ThemeContext';

/** Texto e véus sobre o gradiente do cabeçalho: branco com transparência nos dois temas. */
const SOBRE_O_GRADIENTE = {
  textoForte: 'rgba(255,255,255,0.9)',
  textoMedio: 'rgba(255,255,255,0.8)',
  textoSuave: 'rgba(255,255,255,0.75)',
  veu: 'rgba(255,255,255,0.15)',
  veuForte: 'rgba(255,255,255,0.22)',
  borda: 'rgba(255,255,255,0.2)',
};

const sombraDeCartao = (colors: ThemeColors) =>
  Platform.select({
    ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
    android: { elevation: 2 },
  });

export const criarEstilosDoInicio = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1, backgroundColor: colors.background },
    scrollContent: { flexGrow: 1 },
    fimDaPagina: { height: SPACING.xl },

    header: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.xl + 4, gap: SPACING.sm },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    headerLeft: { gap: 1, flex: 1 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    saudacao: { fontSize: FONT_SIZE.md, color: SOBRE_O_GRADIENTE.textoMedio, fontWeight: '500' },
    nomeAgente: { fontSize: FONT_SIZE.xxl, fontWeight: '800', color: colors.onGradient, letterSpacing: -0.5 },
    dateText: { fontSize: FONT_SIZE.sm, color: SOBRE_O_GRADIENTE.textoSuave, marginTop: 2 },

    avatarCircle: {
      width: 42, height: 42, borderRadius: 21,
      backgroundColor: SOBRE_O_GRADIENTE.veuForte,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
      overflow: 'hidden',
    },
    avatarImage: { width: 42, height: 42, borderRadius: 21 },
    avatarText: { fontSize: FONT_SIZE.sm, fontWeight: '800', color: colors.onGradient },
    logoutBtn: { padding: 4 },

    unidadeChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: RADIUS.full,
      paddingHorizontal: 10, paddingVertical: 4,
    },
    unidadeText: { fontSize: FONT_SIZE.xs, color: SOBRE_O_GRADIENTE.textoForte, fontWeight: '600', maxWidth: 220 },

    metaCard: {
      backgroundColor: SOBRE_O_GRADIENTE.veu, borderRadius: RADIUS.md, padding: SPACING.sm + 4, gap: 6,
      borderWidth: 1, borderColor: SOBRE_O_GRADIENTE.borda,
    },
    metaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    metaTitle: { fontSize: FONT_SIZE.sm, color: SOBRE_O_GRADIENTE.textoForte, fontWeight: '600' },
    metaPercent: { fontSize: FONT_SIZE.md, fontWeight: '800', color: colors.onGradient },
    metaBarBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 4, overflow: 'hidden' },
    metaBarFill: { height: '100%', backgroundColor: colors.onGradient, borderRadius: 4 },
    metaSubtext: { fontSize: FONT_SIZE.xs, color: SOBRE_O_GRADIENTE.textoSuave },

    statsRow: {
      flexDirection: 'row', gap: SPACING.xs,
      marginHorizontal: SPACING.md, marginTop: -SPACING.lg, marginBottom: SPACING.md,
    },
    section: { paddingHorizontal: SPACING.md, marginBottom: SPACING.md },
    actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, justifyContent: 'space-between' },
    quickAction: { width: '31%' },

    recentCard: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      backgroundColor: colors.card, borderRadius: RADIUS.md,
      padding: SPACING.sm + 4, marginBottom: SPACING.xs,
      ...sombraDeCartao(colors),
    },
    recentIcon: {
      width: 36, height: 36, borderRadius: RADIUS.sm,
      backgroundColor: colors.infoLight, alignItems: 'center', justifyContent: 'center',
    },
    recentTexto: { flex: 1 },
    recentTitle: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: colors.text },
    recentSub: { fontSize: FONT_SIZE.xs, color: colors.textLight },

    linha: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 10 },
    linhaComDivisor: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
    linhaIcone: { width: 34, height: 34, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
    linhaRotulo: { flex: 1, fontSize: FONT_SIZE.md, color: colors.text },
    linhaValor: { fontSize: FONT_SIZE.md, fontWeight: '700', color: colors.primary },
  });

export type EstilosDoInicio = ReturnType<typeof criarEstilosDoInicio>;
