import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { obterChaveDoBanco } from '../chave';
import { SECURE_KEYS } from '../../utils/constants';

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'quando-desbloqueado-neste-aparelho',
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
}));

const getItem = SecureStore.getItemAsync as jest.Mock;
const setItem = SecureStore.setItemAsync as jest.Mock;
const getRandom = Crypto.getRandomBytesAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('obterChaveDoBanco', () => {
  it('sorteia e guarda a chave na primeira vez', async () => {
    getItem.mockResolvedValue(null);
    getRandom.mockResolvedValue(new Uint8Array(32).fill(0xab));

    const chave = await obterChaveDoBanco();

    expect(chave).toBe('ab'.repeat(32));
    expect(chave).toHaveLength(64);
    expect(getRandom).toHaveBeenCalledWith(32);
    expect(setItem).toHaveBeenCalledWith(
      SECURE_KEYS.ENCRYPTION_KEY,
      chave,
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
    );
  });

  it('reusa a chave guardada e não sorteia de novo', async () => {
    getItem.mockResolvedValue('cc'.repeat(32));

    const chave = await obterChaveDoBanco();

    expect(chave).toBe('cc'.repeat(32));
    expect(getRandom).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('gera 256 bits (64 caracteres hexadecimais)', async () => {
    getItem.mockResolvedValue(null);
    getRandom.mockResolvedValue(
      Uint8Array.from({ length: 32 }, (_, i) => i)
    );

    const chave = await obterChaveDoBanco();

    expect(chave).toMatch(/^[0-9a-f]{64}$/);
  });
});
