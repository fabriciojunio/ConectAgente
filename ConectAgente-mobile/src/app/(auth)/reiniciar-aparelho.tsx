import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInput } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/button';
import { PageHeader } from '../../components/ui/PageHeader';
import { reinicioService } from '../../services/reinicioService';
import { SPACING, FONT_SIZE, RADIUS } from '../../utils/constants';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';

/** Palavra que a pessoa digita para confirmar. Evita apagar por toque acidental. */
const CONFIRMACAO = 'APAGAR';

/**
 * Reiniciar o aparelho, para quem perdeu a senha e o código do administrador.
 *
 * Antes a única saída era desinstalar, sem saber o que se perdia. Aqui a tela
 * diz quanto ainda não foi para o servidor e pede para sincronizar antes. O
 * motivo de apagar tudo, e não só a conta do administrador, está em
 * services/reinicioService.ts.
 */
export default function ReiniciarAparelho() {
  const { colors } = useTheme();
  const styles = useMemo(() => criarStyles(colors), [colors]);
  const [naoSincronizados, setNaoSincronizados] = useState<number | null>(null);
  const [confirmacao, setConfirmacao] = useState('');
  const [apagando, setApagando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      reinicioService
        .contarNaoSincronizados()
        .then(setNaoSincronizados)
        .catch(() => setNaoSincronizados(null));
    }, [])
  );

  async function reiniciar() {
    setApagando(true);
    try {
      await reinicioService.reiniciar();
      Alert.alert(
        'Aparelho reiniciado',
        'Os dados deste aparelho foram apagados. Configure o administrador para começar de novo.'
      );
      router.replace('/(auth)/login');
    } catch (erro) {
      Alert.alert(
        'Não foi possível reiniciar',
        erro instanceof Error ? erro.message : 'Tente novamente.'
      );
    } finally {
      setApagando(false);
    }
  }

  const liberado = confirmacao.trim().toUpperCase() === CONFIRMACAO;

  return (
    <SafeAreaView style={styles.container}>
      <PageHeader title="Reiniciar aparelho" showBack />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.banner}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.texto}>
            Use só se o administrador perdeu a senha e o código de recuperação. Agente que
            perdeu a senha não precisa disto: o administrador gera um código novo na tela de
            agentes.
          </Text>
        </View>

        <Text style={styles.texto}>
          Reiniciar apaga deste aparelho todas as contas, residências, moradores e visitas. O que
          já foi sincronizado continua no servidor e no painel.
        </Text>

        {naoSincronizados !== null && naoSincronizados > 0 ? (
          <View style={[styles.banner, styles.bannerPerigo]}>
            <Ionicons name="warning-outline" size={20} color={colors.error} />
            <Text style={styles.texto}>
              {naoSincronizados === 1
                ? 'Há 1 registro que ainda não foi para o servidor e será perdido.'
                : `Há ${naoSincronizados} registros que ainda não foram para o servidor e serão perdidos.`}{' '}
              Antes de reiniciar, peça a cada agente para entrar no aplicativo com internet e
              sincronizar.
            </Text>
          </View>
        ) : naoSincronizados === 0 ? (
          <View style={styles.banner}>
            <Ionicons name="cloud-done-outline" size={20} color={colors.success} />
            <Text style={styles.texto}>Tudo o que foi registrado aqui já está no servidor.</Text>
          </View>
        ) : null}

        <Text style={styles.rotulo}>Para confirmar, digite {CONFIRMACAO}</Text>
        <TextInput
          style={styles.campo}
          value={confirmacao}
          onChangeText={setConfirmacao}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={CONFIRMACAO}
          placeholderTextColor={colors.placeholder}
        />

        <Button
          title="Apagar tudo e reiniciar"
          variant="danger"
          onPress={reiniciar}
          disabled={!liberado}
          loading={apagando}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const criarStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xl },
    banner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
      backgroundColor: colors.infoLight,
      padding: SPACING.md,
      borderRadius: RADIUS.sm,
    },
    bannerPerigo: { backgroundColor: colors.errorLight },
    texto: { flex: 1, fontSize: FONT_SIZE.sm, color: colors.text, lineHeight: 20 },
    rotulo: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: colors.text },
    campo: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      padding: SPACING.sm,
      fontSize: FONT_SIZE.md,
      color: colors.text,
      backgroundColor: colors.inputBg,
    },
  });
