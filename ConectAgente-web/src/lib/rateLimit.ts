import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Limite de tentativas das Server Actions (login, cadastro, aprovação).
 *
 * A contagem mora no banco (`registrar_tentativa`, em
 * migration_limite_de_tentativas.sql), e não na memória do processo. Na
 * Vercel cada instância tem a própria memória e uma instância nova começa do
 * zero: com contagem local, quem testa senhas ganhava um limite por
 * instância, e cada deploy zerava tudo.
 *
 * Sem `'use server'` de propósito. Com ele, esta função virava uma ação que o
 * navegador conseguia chamar direto, e qualquer um gastaria o limite de outra
 * pessoa. Ela só é chamada de dentro das ações do servidor.
 */

export interface ResultadoDoLimite {
  allowed: boolean;
  retryAfterMs: number;
}

/**
 * CPF e IP são dado pessoal, e o banco não precisa saber de quem é a
 * tentativa, só quantas foram. Fica o prefixo legível para diagnóstico.
 */
export function chaveAnonimizada(identificador: string): string {
  const separador = identificador.indexOf(':');
  const prefixo = separador > 0 ? identificador.slice(0, separador) : 'limite';
  const valor = separador > 0 ? identificador.slice(separador + 1) : identificador;
  return `${prefixo}:${createHash('sha256').update(valor).digest('hex')}`;
}

// ---------------------------------------------------------------------------
// Reserva em memória
//
// Usada quando o banco não responde ou quando a migração ainda não foi
// aplicada. Falhar aberto deixaria o login sem limite nenhum justamente quando
// algo está errado; falhar fechado trancaria todo mundo do lado de fora. A
// contagem local é o meio-termo: continua limitando, só que por instância.
// ---------------------------------------------------------------------------

interface EntradaLocal {
  count: number;
  resetAt: number;
}

const memoria = new Map<string, EntradaLocal>();
const INTERVALO_DE_LIMPEZA_MS = 5 * 60 * 1000;
let ultimaLimpeza = Date.now();
let avisouDaReserva = false;

function limparMemoria(agora: number) {
  if (agora - ultimaLimpeza < INTERVALO_DE_LIMPEZA_MS) return;
  ultimaLimpeza = agora;
  for (const [chave, entrada] of memoria) {
    if (agora > entrada.resetAt) memoria.delete(chave);
  }
}

function limiteEmMemoria(chave: string, maximo: number, janelaMs: number): ResultadoDoLimite {
  const agora = Date.now();
  limparMemoria(agora);

  const entrada = memoria.get(chave);
  if (!entrada || agora > entrada.resetAt) {
    memoria.set(chave, { count: 1, resetAt: agora + janelaMs });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (entrada.count >= maximo) {
    return { allowed: false, retryAfterMs: entrada.resetAt - agora };
  }
  entrada.count++;
  return { allowed: true, retryAfterMs: 0 };
}

async function limiteNoBanco(
  chave: string,
  maximo: number,
  janelaMs: number
): Promise<ResultadoDoLimite | null> {
  try {
    const { data, error } = await createAdminClient()
      .rpc('registrar_tentativa', { p_chave: chave, p_maximo: maximo, p_janela_ms: janelaMs })
      .single<{ permitido: boolean; espera_ms: number }>();
    if (error || !data) return null;
    return { allowed: data.permitido, retryAfterMs: data.permitido ? 0 : data.espera_ms };
  } catch {
    return null;
  }
}

/**
 * Conta mais uma tentativa e responde se ela pode seguir.
 *
 * @param identifier - prefixo da ação e quem tenta, ex.: `login_cpf:12345678901`
 * @param maxRequests - tentativas permitidas dentro da janela
 * @param windowMs - tamanho da janela em milissegundos (padrão: 60 segundos)
 */
export async function rateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number = 60_000
): Promise<ResultadoDoLimite> {
  const chave = chaveAnonimizada(identifier);

  const doBanco = await limiteNoBanco(chave, maxRequests, windowMs);
  if (doBanco) return doBanco;

  if (!avisouDaReserva) {
    avisouDaReserva = true;
    console.warn('[limite] banco indisponível ou sem a migração; contando em memória nesta instância');
  }
  return limiteEmMemoria(chave, maxRequests, windowMs);
}
