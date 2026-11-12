/**
 * Cliente Supabase, backend gratuito e escalável.
 *
 * Supabase free tier:
 *   - 500 MB de banco de dados PostgreSQL
 *   - Requisições ilimitadas (fair use)
 *   - 5 GB de armazenamento de arquivos
 *   - 50.000 usuários ativos/mês
 *   - Row-Level Security (isolamento de dados por agente)
 *
 * Configuração:
 *   1. Acesse https://supabase.com → crie um projeto gratuito
 *   2. Vá em Project Settings → API
 *   3. Copie "Project URL" e "anon public key"
 *   4. Crie o arquivo .env com as variáveis (veja .env.example)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const urlConfigurada = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const chaveConfigurada = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Valores que vêm do `.env.example` e não são servidor nenhum.
 *
 * Por que isto existe. Quem clona o projeto copia o `.env.example` para
 * `.env` e preenche aos poucos, e o APK compilado nesse meio do caminho
 * carregava `https://seu-projeto.supabase.co`. String não vazia, então o
 * aplicativo se considerava configurado, tentava falar com um host que não
 * existe e a tela mostrava erro de rede. O agente em campo conclui que está
 * sem sinal, quando o que falta é configuração.
 *
 * O painel web já recusava esses valores em `src/lib/env.ts`. Os dois lados
 * precisam da mesma regra, senão o mesmo `.env` meio preenchido dá
 * diagnóstico diferente em cada aplicativo.
 */
const MARCAS_DE_EXEMPLO = ['seu-projeto', 'placeholder', 'sua-api', 'SEU_ID'];

export function ehValorDeExemplo(valor: string): boolean {
  return MARCAS_DE_EXEMPLO.some((marca) => valor.includes(marca));
}

/**
 * O Supabase tem dois formatos de chave em circulação, e os dois são válidos.
 *
 * O antigo é um JWT: `eyJ...` em três partes separadas por ponto, passando de
 * 100 caracteres. O `.env.example` traz só o cabeçalho dele, com 39, e foi por
 * isso que o tamanho entrou na conta.
 *
 * O novo começa com `sb_publishable_` e tem 46 caracteres. Projeto criado
 * depois da mudança sai só com ele.
 *
 * Exigir 100 caracteres, como estava aqui, recusava a chave nova em silêncio:
 * o aplicativo dizia "não configurado" com uma credencial perfeitamente boa, e
 * o agente concluía que estava sem sinal. É o mesmo diagnóstico errado que o
 * valor de exemplo causava, agora pelo lado oposto.
 *
 * O formato novo traz uma vantagem: `sb_publishable_` e `sb_secret_` se
 * distinguem à vista. No formato antigo a chave `anon` e a `service_role` eram
 * dois JWTs parecidos, e trocar uma pela outra só aparecia em produção.
 */
const PREFIXO_PUBLICA = 'sb_publishable_';
const PREFIXO_SECRETA = 'sb_secret_';
const TAMANHO_MINIMO_JWT = 100;

export function ehChavePublicaValida(valor: string): boolean {
  if (valor.startsWith(PREFIXO_SECRETA)) return false; // nunca no aplicativo
  if (valor.startsWith(PREFIXO_PUBLICA)) return valor.length > PREFIXO_PUBLICA.length;
  return valor.split('.').length === 3 && valor.length >= TAMANHO_MINIMO_JWT;
}

/** Diz se o servidor está configurado. A sincronização depende disto. */
export const supabaseConfigurado =
  urlConfigurada !== '' &&
  chaveConfigurada !== '' &&
  !ehValorDeExemplo(urlConfigurada) &&
  !ehValorDeExemplo(chaveConfigurada) &&
  ehChavePublicaValida(chaveConfigurada);

if (!supabaseConfigurado) {
  console.warn(
    '[Supabase] Variáveis de ambiente não configuradas. ' +
    'Crie o arquivo .env com EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'O aplicativo funciona offline, mas nada será sincronizado.'
  );
}

// Endereço de reserva para quando as variáveis não estão definidas.
//
// O `createClient` lança `supabaseUrl is required` se receber string vazia, e
// isso acontecia na importação do módulo: o aviso acima era escrito e a linha
// seguinte derrubava o aplicativo inteiro, antes de qualquer tela aparecer.
// Num sistema offline-first isso é o avesso do que se quer, porque o agente
// em campo precisa registrar a visita mesmo sem servidor nenhum configurado.
//
// Com o endereço de reserva o módulo carrega, o aplicativo abre e trabalha
// offline, e a sincronização falha com mensagem própria quando for tentada.
const URL_RESERVA = 'https://servidor-nao-configurado.invalid';

// Usa `supabaseConfigurado`, e não `urlConfigurada || URL_RESERVA`: o valor de
// exemplo é string não vazia, então o `||` o deixava passar e o cliente saía
// apontado para um endereço que não responde.
export const supabase = createClient(
  supabaseConfigurado ? urlConfigurada : URL_RESERVA,
  supabaseConfigurado ? chaveConfigurada : 'chave-nao-configurada',
  {
  auth: {
    // Usa AsyncStorage para persistir sessão entre reinicializações do app
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  },
  global: {
    headers: {
      'x-app-version': '1.0.0',
      'x-client': 'conectagente-mobile',
    },
  },
});

/**
 * Tipos das tabelas do Supabase (gerados automaticamente pela estrutura).
 * Para regenerar: npx supabase gen types typescript --project-id SEU_ID > src/lib/supabase.types.ts
 */
export type SupabaseTable =
  | 'agentes'
  | 'residencias'
  | 'moradores'
  | 'prontuarios'
  | 'prontuario_saude'
  | 'prontuario_gestante'
  | 'prontuario_puericultura'
  | 'prontuario_mulher'
  | 'prontuario_social'
  | 'visitas'
  | 'agendamentos'
  | 'metas_visitas'
  | 'audit_log'
  | 'consentimentos'
  | 'medicamentos';

/**
 * Helper para lidar com erros do Supabase de forma padronizada.
 */
export function handleSupabaseError(error: { message: string; code?: string } | null): void {
  if (!error) return;
  console.error(`[Supabase] ${error.code ?? 'ERR'}: ${error.message}`);
  throw new Error(error.message);
}
