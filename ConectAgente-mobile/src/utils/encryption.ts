/**
 * Hash de senha e sorteio do código de recuperação.
 *
 * Hash: PBKDF2-HMAC-SHA256 com sal de 16 bytes. Formato:
 * "pbkdf2-sha256$<iteracoes>$<sal_hex>$<hash_hex>".
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
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';

// ============================================================
// HASH: SHA-256 simples (sem salt)
// ============================================================

export async function hashSHA256(value: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}

// ============================================================
// HASH DE SENHA: PBKDF2-HMAC-SHA256
// ============================================================

/**
 * Por que PBKDF2, e por que este número de iterações.
 *
 * O formato anterior era um SHA-256 com sal, uma passada só. Sal impede
 * tabela pronta, mas não atrasa quem testa senha por senha: um computador
 * comum faz bilhões de SHA-256 por segundo, e uma senha de 8 caracteres caía
 * em minutos se o banco vazasse. PBKDF2 repete o HMAC milhares de vezes e
 * multiplica esse custo pelo mesmo fator.
 *
 * A implementação é a `@noble/hashes`, auditada e sem dependências, em
 * JavaScript puro: o Expo não expõe PBKDF2 nativo, e um módulo nativo a mais
 * pesaria no build do APK. JavaScript puro no Hermes é bem mais lento que no
 * Node, e é isso que limita o número: 100 mil iterações levaram 150 ms no
 * Node desta máquina, o que no celular fica perto de um segundo por login. O
 * OWASP pede 600 mil para servidor; aqui seriam vários segundos a cada entrada
 * do agente em campo. O banco já é cifrado inteiro com SQLCipher, então o hash
 * é a segunda camada, e não a única.
 *
 * O número de iterações vai dentro do hash. Subir este valor numa versão
 * futura não quebra ninguém: o login confere com o número gravado e regrava
 * com o novo (`precisaAtualizarHash`).
 */
export const ITERACOES_PBKDF2 = 100_000;
const PREFIXO_PBKDF2 = 'pbkdf2-sha256';
const TAMANHO_DO_HASH = 32;

function paraHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparação que leva o mesmo tempo acerte ou erre o começo do texto. */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

async function derivar(senha: string, salHex: string, iteracoes: number): Promise<string> {
  // `asyncTick` devolve o controle à interface de tempos em tempos: sem isto
  // a tela congela durante o cálculo.
  const bytes = await pbkdf2Async(sha256, senha, salHex, {
    c: iteracoes,
    dkLen: TAMANHO_DO_HASH,
    asyncTick: 20,
  });
  return paraHex(bytes);
}

export async function hashSenha(senha: string): Promise<string> {
  const sal = paraHex(await Crypto.getRandomBytesAsync(16));
  const hash = await derivar(senha, sal, ITERACOES_PBKDF2);
  return `${PREFIXO_PBKDF2}$${ITERACOES_PBKDF2}$${sal}$${hash}`;
}

/**
 * Hash no formato atual que nenhuma senha produz.
 *
 * Quem confere senha de conta que não existe compara contra este valor, e
 * gasta o mesmo tempo de uma conta de verdade. Sem isso, a demora (ou a falta
 * dela) diria se o CPF está cadastrado no aparelho.
 */
export const HASH_QUE_NUNCA_CONFERE =
  `${PREFIXO_PBKDF2}$${ITERACOES_PBKDF2}$${'0'.repeat(32)}$${'0'.repeat(64)}`;

/**
 * Verifica senha contra hash armazenado.
 *
 * Aceita os três formatos que já existiram, para ninguém ficar trancado fora
 * na atualização:
 * - `pbkdf2-sha256$<iteracoes>$<sal>$<hash>`, o atual;
 * - `<sal>$<sha256(sal + senha)>`, da 1.0 à 1.2;
 * - `<sha256(senha)>`, sem sal, o mais antigo.
 *
 * Os dois antigos são regravados no formato atual no primeiro login que
 * acertar (`precisaAtualizarHash`).
 */
export async function verificarSenha(senha: string, stored: string): Promise<boolean> {
  const partes = stored.split('$');

  if (partes[0] === PREFIXO_PBKDF2 && partes.length === 4) {
    const iteracoes = Number(partes[1]);
    if (!Number.isInteger(iteracoes) || iteracoes < 1) return false;
    const calculado = await derivar(senha, partes[2], iteracoes);
    return iguaisEmTempoConstante(calculado, partes[3]);
  }

  if (partes.length === 2) {
    const [salt, hash] = partes;
    const calculado = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      salt + senha
    );
    return iguaisEmTempoConstante(calculado, hash);
  }

  // Formato legado, sem sal.
  return iguaisEmTempoConstante(await hashSHA256(senha), stored);
}

/** Diz se o hash está num formato antigo ou com menos iterações que o atual. */
export function precisaAtualizarHash(stored: string): boolean {
  const partes = stored.split('$');
  if (partes[0] !== PREFIXO_PBKDF2 || partes.length !== 4) return true;
  return Number(partes[1]) < ITERACOES_PBKDF2;
}

// ============================================================
// CÓDIGO DE RECUPERAÇÃO
// ============================================================

/**
 * 32 símbolos, sem os que se confundem na leitura (O e 0, I e 1).
 *
 * Tamanho 32 de propósito: 256 é múltiplo de 32, então `byte % 32` sorteia
 * cada símbolo com a mesma chance. Com outro tamanho, os primeiros símbolos
 * sairiam mais vezes que os últimos.
 */
const ALFABETO_DO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TAMANHO_DO_CODIGO = 12;

/**
 * Sorteia um código de recuperação de conta, no formato `XXXX-XXXX-XXXX`.
 *
 * É o que substitui a recuperação por CPF e e-mail. CPF e e-mail não são
 * segredo: o CPF do administrador aparecia na própria tela de entrada e o
 * e-mail dele estava no código, e qualquer pessoa com o aparelho na mão
 * redefinia a senha do administrador. O código é mostrado uma vez, a quem é
 * dono da conta, e só o hash fica guardado.
 *
 * 12 símbolos de um alfabeto de 32 são 60 bits: não dá para adivinhar
 * tentando, mesmo sem limite de tentativas.
 */
export async function sortearCodigoRecuperacao(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(TAMANHO_DO_CODIGO);
  const simbolos = Array.from(bytes, (b) => ALFABETO_DO_CODIGO[b % ALFABETO_DO_CODIGO.length]).join('');
  return `${simbolos.slice(0, 4)}-${simbolos.slice(4, 8)}-${simbolos.slice(8, 12)}`;
}

/** Aceita o código digitado com minúscula, espaço ou sem os hífens. */
export function normalizarCodigoRecuperacao(codigo: string): string {
  return codigo.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
