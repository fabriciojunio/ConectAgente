import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../button';
import { SPACING, FONT_SIZE, RADIUS } from '../../utils/constants';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';

interface Props {
  codigo: string;
  /** Texto do botão que confirma que a pessoa anotou. */
  tituloDoBotao: string;
  onConfirmar: () => void;
}

/**
 * Mostra o código de recuperação de uma conta, uma única vez.
 *
 * O código não pode ser lido de volta depois: só o hash fica no aparelho.
 * Por isso a tela é explícita sobre anotar e guardar longe do celular.
 * `selectable` deixa copiar o código, para quem prefere guardar num
 * gerenciador de senhas.
 */
export function CodigoRecuperacao({ codigo, tituloDoBotao, onConfirmar }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => criarStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Ionicons name="key-outline" size={48} color={colors.primary} />
      <Text style={styles.titulo}>Seu código de recuperação</Text>
      <Text style={styles.codigo} selectable accessibilityLabel={`Código ${codigo.split('').join(' ')}`}>
        {codigo}
      </Text>
      <Text style={styles.texto}>
        Anote este código e guarde longe do celular. Ele é a única forma de
        redefinir a senha em "Esqueci minha senha".
      </Text>
      <Text style={styles.aviso}>
        Ele aparece só agora. Depois de usado, o aplicativo mostra um código novo.
      </Text>
      <Button title={tituloDoBotao} onPress={onConfirmar} />
    </View>
  );
}

const criarStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { alignItems: 'center', gap: SPACING.md, paddingTop: SPACING.lg },
    titulo: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: colors.text, textAlign: 'center' },
    codigo: {
      fontSize: FONT_SIZE.xxl,
      fontWeight: '800',
      letterSpacing: 2,
      color: colors.primary,
      backgroundColor: colors.infoLight,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.md,
      fontVariant: ['tabular-nums'],
    },
    texto: { fontSize: FONT_SIZE.md, color: colors.text, textAlign: 'center', lineHeight: 22 },
    aviso: { fontSize: FONT_SIZE.sm, color: colors.textLight, textAlign: 'center', lineHeight: 20 },
  });
