/**
 * Hash de senha e sorteio de senha inicial.
 *
 * Hash: SHA-256 com sal de 16 bytes. Formato: "<sal_hex>$<hash_hex>".
 *
 * O que **não** existe mais aqui: a cifra de campo. O módulo tinha
 * `encryptField`, `encryptSensitiveFields` e um SHA-256 em modo contador feito
 * à mão, e nenhuma linha do aplicativo chamava nada disso, em nenhum commit do
 * histórico. Os campos de identificação sempre estiveram em texto puro no
 * SQLite, e três documentos afirmavam o contrário.
 *
 * Foi removida em vez de ligada, por duas razões. A cifra não autenticava:
 * fluxo sem MAC é maleável, e quem tivesse o arquivo poderia alterar o texto
 * claro de forma previsível sem a chave. E cifrar `nome` e `cpf` quebraria a
 * busca local, que é o que o agente usa em campo para achar o paciente.
 *
 * Código morto com cara de segurança é pior que a ausência dele: convida a ser
 * ligado por quem precisa de "criptografia" e não vai reler a construção.
 *
 * A saída de verdade foi SQLCipher no banco inteiro, ligado na 1.2.0
 * (database/database.ts): preserva a busca e é AEAD de verdade. Detalhe em
 * docs/seguranca.md.
 */
import * as Crypto from 'expo-crypto';
// HASH: SHA-256 simples (sem salt)
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
  // Formato legado, migração automática ocorre em autenticar()
  const legacyHash = await hashSHA256(senha);
  return legacyHash === stored;
}

// ============================================================
// SENHA INICIAL SORTEADA
// ============================================================

/**
 * Sorteia uma senha forte para o primeiro acesso do administrador.
 *
 * Existe porque a senha do administrador era uma constante no codigo
 * (`Admin@2025`), repetida no README e impressa na tela de configuracoes.
 * Em repositorio publico isso e credencial publicada: quem encontrasse uma
 * instalacao no ar entrava como administrador e lia o prontuario de todos.
 *
 * O alfabeto evita caracteres que se confundem na leitura (O e 0, l e 1),
 * porque esta senha e lida de uma tela e digitada a mao.
 */
export async function sortearSenhaForte(tamanho = 16): Promise<string> {
  const MAIUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const MINUSCULAS = 'abcdefghijkmnopqrstuvwxyz';
  const NUMEROS = '23456789';
  const SIMBOLOS = '!@#$%&*?';
  const TODOS = MAIUSCULAS + MINUSCULAS + NUMEROS + SIMBOLOS;

  const bytes = await Crypto.getRandomBytesAsync(tamanho * 2);
  let indice = 0;
  const sortear = (alfabeto: string): string =>
    alfabeto[bytes[indice++ % bytes.length] % alfabeto.length];

  // Garante um de cada classe, para a senha passar em qualquer validacao.
  const obrigatorios = [
    sortear(MAIUSCULAS),
    sortear(MINUSCULAS),
    sortear(NUMEROS),
    sortear(SIMBOLOS),
  ];
  const resto = Array.from({ length: Math.max(0, tamanho - obrigatorios.length) }, () =>
    sortear(TODOS)
  );

  // Embaralha para os obrigatorios nao ficarem sempre nas quatro primeiras
  // posicoes, o que reduziria o espaco de busca de quem souber da regra.
  const chars = [...obrigatorios, ...resto];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[(indice + i) % bytes.length] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}
