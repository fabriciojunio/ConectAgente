import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Onde o endereço da foto fica guardado no aparelho. Só a URI local, nunca a imagem. */
export const CHAVE_DA_FOTO = 'profile_photo_uri';

const OPCOES_DE_RECORTE = { allowsEditing: true, aspect: [1, 1] as [number, number], quality: 0.7 };

/**
 * Foto de perfil do agente: lê, troca e remove.
 *
 * Ficava escrita dentro da tela de Início, com a chave repetida na tela Mais.
 */
export function useFotoDePerfil() {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(CHAVE_DA_FOTO).then((guardada) => {
      if (guardada) setUri(guardada);
    });
  }, []);

  const guardar = useCallback(async (resultado: ImagePicker.ImagePickerResult) => {
    const escolhida = !resultado.canceled ? resultado.assets[0]?.uri : undefined;
    if (!escolhida) return;
    await AsyncStorage.setItem(CHAVE_DA_FOTO, escolhida);
    setUri(escolhida);
  }, []);

  const tirarFoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Permita o acesso à câmera nas configurações do celular.');
      return;
    }
    await guardar(await ImagePicker.launchCameraAsync(OPCOES_DE_RECORTE));
  }, [guardar]);

  const escolherDaGaleria = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Permita o acesso à galeria nas configurações do celular.');
      return;
    }
    await guardar(
      await ImagePicker.launchImageLibraryAsync({ ...OPCOES_DE_RECORTE, mediaTypes: ImagePicker.MediaTypeOptions.Images })
    );
  }, [guardar]);

  const remover = useCallback(async () => {
    await AsyncStorage.removeItem(CHAVE_DA_FOTO);
    setUri(null);
  }, []);

  /** Abre as opções de foto (tirar, galeria, remover). */
  const escolher = useCallback(() => {
    Alert.alert('Foto de perfil', 'Escolha uma opção', [
      { text: 'Tirar foto', onPress: tirarFoto },
      { text: 'Escolher da galeria', onPress: escolherDaGaleria },
      ...(uri ? [{ text: 'Remover foto', style: 'destructive' as const, onPress: remover }] : []),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  }, [uri, tirarFoto, escolherDaGaleria, remover]);

  return { uri, escolher };
}
