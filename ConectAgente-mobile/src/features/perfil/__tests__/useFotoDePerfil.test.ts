import { Alert } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { CHAVE_DA_FOTO, useFotoDePerfil } from '../useFotoDePerfil';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
type Botao = { text: string; onPress?: () => Promise<void> };

/** Abre o menu da foto e toca no botão com o texto pedido. */
async function tocarNaOpcao(escolher: () => void, texto: string) {
  const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  escolher();
  const botoes = alerta.mock.calls.at(-1)?.[2] as Botao[];
  await act(async () => {
    await botoes.find((b) => b.text === texto)?.onPress?.();
  });
  return botoes.map((b) => b.text);
}

beforeEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('useFotoDePerfil', () => {
  it('lê a foto já guardada no aparelho', async () => {
    await AsyncStorage.setItem(CHAVE_DA_FOTO, 'file:///foto.jpg');
    const { result } = renderHook(() => useFotoDePerfil());
    await waitFor(() => expect(result.current.uri).toBe('file:///foto.jpg'));
  });

  it('sem foto, o menu não oferece remover', async () => {
    const { result } = renderHook(() => useFotoDePerfil());
    const opcoes = await tocarNaOpcao(result.current.escolher, 'Cancelar');
    expect(opcoes).toEqual(['Tirar foto', 'Escolher da galeria', 'Cancelar']);
  });

  it('tira a foto, guarda só o endereço local e mostra', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///nova.jpg' }] } as never);
    const { result } = renderHook(() => useFotoDePerfil());
    await tocarNaOpcao(result.current.escolher, 'Tirar foto');
    expect(result.current.uri).toBe('file:///nova.jpg');
    await expect(AsyncStorage.getItem(CHAVE_DA_FOTO)).resolves.toBe('file:///nova.jpg');
  });

  it('sem permissão da câmera, avisa e não abre a câmera', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);
    const { result } = renderHook(() => useFotoDePerfil());
    await tocarNaOpcao(result.current.escolher, 'Tirar foto');
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
    expect(result.current.uri).toBeNull();
  });

  it('escolha cancelada na galeria não muda nada', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null } as never);
    const { result } = renderHook(() => useFotoDePerfil());
    await tocarNaOpcao(result.current.escolher, 'Escolher da galeria');
    expect(result.current.uri).toBeNull();
  });

  it('remove a foto do aparelho', async () => {
    await AsyncStorage.setItem(CHAVE_DA_FOTO, 'file:///foto.jpg');
    const { result } = renderHook(() => useFotoDePerfil());
    await waitFor(() => expect(result.current.uri).toBe('file:///foto.jpg'));
    await tocarNaOpcao(result.current.escolher, 'Remover foto');
    expect(result.current.uri).toBeNull();
    await expect(AsyncStorage.getItem(CHAVE_DA_FOTO)).resolves.toBeNull();
  });
});
