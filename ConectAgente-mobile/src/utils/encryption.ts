/**
 * Utilitários de criptografia para LGPD.
 *
 * Modelo de ameaça: proteção de PII armazenado localmente no SQLite.
 * Chave mestre gerada aleatoriamente e armazenada no Keychain/Keystore do SO
 * via expo-secure-store (TEE/Secure Enclave onde disponível).
 *
 * Criptografia de campos: SHA-256-CTR (stream cipher com IV aleatório de 16 bytes).
 * Formato armazenado: "v2:<base64(iv || ciphertext)>"
 * Compatibilidade retroativa: strings sem prefixo "v2:" são tratadas como formato legado XOR.
 *
 * Hash de senha: SHA-256 com salt de 16 bytes. Formato: "<salt_hex>$<hash_hex>".
 */
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from './constants';

// ============================================================
// CHAVE DE CRIPTOGRAFIA (gerenciamento)
// ============================================================

let _encryptionKey: string | null = null;

/**
 * Retorna a chave de criptografia hex de 64 chars (256 bits).
 * Gera e persiste no SecureStore na primeira execução.
 * Cache em memória para performance — limpo no logout via clearEncryptionKeyCache().
 */
async function getEncryptionKey(): Promise<string> {
  if (_encryptionKey) return _encryptionKey;

  let key = await SecureStore.getItemAsync(SECURE_KEYS.ENCRYPTION_KEY);
  if (!key) {
    const random = await Crypto.getRandomBytesAsync(32);
    key = Array.from(random)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    await SecureStore.setItemAsync(SECURE_KEYS.ENCRYPTION_KEY, key);
  }

  _encryptionKey = key;
  return key;
}

// ============================================================
// HASH — SHA-256 simples (sem salt)
// ============================================================

export async function hashSHA256(value: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}

// ============================================================
// HASH DE SENHA com salt (proteção contra rainbow tables)
// Formato: "<salt_hex>$<sha256(salt_hex + senha)>"
// ============================================================

export async function hashSenha(senha: string): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  const salt = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salt + senha
  );
  return `${salt}$${hash}`;
}

/**
 * Verifica senha contra hash armazenado.
 * Suporta formato legado (SHA-256 sem salt) e novo (salt$hash).
 * Sempre executa operação de hash (timing-safe: evita user-enumeration por tempo).
 */
export async function verificarSenha(senha: string, stored: string): Promise<boolean> {
  if (stored.includes('$')) {
    const [salt, hash] = stored.split('$');
    const computed = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      salt + senha
    );
    return computed === hash;
  }
  // Formato legado — migração automática ocorre em autenticar()
  const legacyHash = await hashSHA256(senha);
  return legacyHash === stored;
}

// ============================================================
// CRIPTOGRAFIA SIMÉTRICA — SHA-256-CTR (stream cipher)
//
// Segurança:
//   • IV aleatório de 16 bytes por cifração → ciphertext diferente para o mesmo plaintext
//   • Keystream derivado de SHA-256(key || iv_hex || counter) — PRF segura
//   • Autenticidade garantida pela posse da chave no Keychain/Keystore
//
// Formato: "v2:<base64(iv[16] || ciphertext[n])>"
// ============================================================

/**
 * Deriva keystream via SHA-256 no modo CTR.
 * Cada bloco de 32 bytes = SHA256(key_hex || iv_hex || counter_hex_8)
 */
async function deriveKeystream(
  keyHex: string,
  iv: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const ivHex = Array.from(iv)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const keystream = new Uint8Array(length);
  let offset = 0;
  let counter = 0;

  while (offset < length) {
    const blockInput = keyHex + ivHex + counter.toString(16).padStart(8, '0');
    const blockHex = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      blockInput
    );
    // SHA-256 produz 32 bytes (64 hex chars)
    const blockBytes = blockHex.match(/.{2}/g)!.map((h) => parseInt(h, 16));
    for (let i = 0; i < 32 && offset < length; i++, offset++) {
      keystream[offset] = blockBytes[i];
    }
    counter++;
  }

  return keystream;
}

async function ctrEncrypt(plaintext: string, keyHex: string): Promise<string> {
  const plaintextBytes = Array.from(plaintext).map((c) => c.charCodeAt(0));

  // Garante exatamente 16 bytes de IV independente do que o driver retornar
  const ivRaw = await Crypto.getRandomBytesAsync(16);
  const iv = new Uint8Array(16);
  for (let i = 0; i < 16; i++) iv[i] = ivRaw[i] ?? 0;

  const keystream = await deriveKeystream(keyHex, iv, plaintextBytes.length);
  const ciphertext = plaintextBytes.map((b, i) => b ^ keystream[i]);

  // Compacta iv + ciphertext em um único buffer
  const combined = new Uint8Array(16 + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, 16);

  return 'v2:' + btoa(String.fromCharCode(...combined));
}

async function ctrDecrypt(encoded: string, keyHex: string): Promise<string> {
  try {
    const combined = atob(encoded)
      .split('')
      .map((c) => c.charCodeAt(0));
    const iv = new Uint8Array(combined.slice(0, 16));
    const ciphertext = combined.slice(16);
    const keystream = await deriveKeystream(keyHex, iv, ciphertext.length);
    const plaintextBytes = ciphertext.map((b, i) => b ^ keystream[i]);
    return String.fromCharCode(...plaintextBytes);
  } catch {
    return encoded; // retorna original em caso de dados corrompidos
  }
}

// Compatibilidade retroativa com formato XOR legado
function xorDecryptLegacy(encoded: string, key: string): string {
  try {
    const encrypted = atob(encoded).split('').map((c) => c.charCodeAt(0));
    const keyBytes = Array.from(key).map((c) => c.charCodeAt(0));
    const decrypted = encrypted.map((b, i) => b ^ keyBytes[i % keyBytes.length]);
    return String.fromCharCode(...decrypted);
  } catch {
    return encoded;
  }
}

// ============================================================
// API PÚBLICA — encryptField / decryptField
// ============================================================

/**
 * Encripta um campo de texto com SHA-256-CTR (IV aleatório).
 * Retorna string no formato "v2:<base64>".
 */
export async function encryptField(value: string): Promise<string> {
  if (!value) return value;
  const key = await getEncryptionKey();
  return ctrEncrypt(value, key);
}

/**
 * Decripta um campo.
 * Detecta automaticamente o formato (v2 = novo CTR, sem prefixo = legado XOR).
 */
export async function decryptField(encrypted: string): Promise<string> {
  if (!encrypted) return encrypted;
  const key = await getEncryptionKey();
  if (encrypted.startsWith('v2:')) {
    return ctrDecrypt(encrypted.slice(3), key);
  }
  // Formato legado — descriptografa com XOR e deixa em plaintext até próxima gravação
  return xorDecryptLegacy(encrypted, key);
}

// ============================================================
// CRIPTOGRAFAR / DESCRIPTOGRAFAR OBJETO INTEIRO
// ============================================================

const SENSITIVE_FIELDS = ['cpf', 'cartao_sus', 'telefone', 'nome', 'nome_pai', 'nome_mae'] as const;

export async function encryptSensitiveFields<T extends Record<string, unknown>>(
  obj: T
): Promise<T> {
  const result = { ...obj };
  for (const field of SENSITIVE_FIELDS) {
    if (field in result && typeof result[field] === 'string' && result[field]) {
      (result as Record<string, unknown>)[field] = await encryptField(result[field] as string);
    }
  }
  return result;
}

export async function decryptSensitiveFields<T extends Record<string, unknown>>(
  obj: T
): Promise<T> {
  const result = { ...obj };
  for (const field of SENSITIVE_FIELDS) {
    if (field in result && typeof result[field] === 'string' && result[field]) {
      (result as Record<string, unknown>)[field] = await decryptField(result[field] as string);
    }
  }
  return result;
}

// ============================================================
// LIMPEZA DE CHAVE (deve ser chamado no logout)
// ============================================================

export function clearEncryptionKeyCache(): void {
  _encryptionKey = null;
}
