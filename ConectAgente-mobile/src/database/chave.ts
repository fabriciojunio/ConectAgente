/**
 * Chave do banco cifrado (SQLCipher).
 *
 * Uma chave aleatória de 256 bits, sorteada na primeira execução e guardada no
 * SecureStore, que no Android fica no Keystore do aparelho. A chave não sai do
 * aparelho (WHEN_UNLOCKED_THIS_DEVICE_ONLY) e nunca é escrita no código nem em
 * log. O banco abre com `PRAGMA key` usando esta chave; ver database.ts.
 *
 * Por que uma chave sorteada e não a senha do agente: o banco precisa abrir
 * mesmo com o aplicativo em segundo plano (tarefa de sincronização), quando não
 * há senha digitada. O que protege a chave é o Keystore, preso ao aparelho.
 */
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../utils/constants';

function paraHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Devolve a chave do banco em hexadecimal (64 caracteres, 256 bits). Sorteia e
 * guarda na primeira vez; nas seguintes, lê a que está no Keystore.
 */
export async function obterChaveDoBanco(): Promise<string> {
  const existente = await SecureStore.getItemAsync(SECURE_KEYS.ENCRYPTION_KEY);
  if (existente) return existente;

  const bytes = await Crypto.getRandomBytesAsync(32);
  const chave = paraHex(bytes);
  await SecureStore.setItemAsync(SECURE_KEYS.ENCRYPTION_KEY, chave, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return chave;
}
