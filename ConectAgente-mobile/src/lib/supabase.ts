/**
 * Cliente Supabase — backend gratuito e escalável.
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

/** Diz se o servidor está configurado. A sincronização depende disto. */
export const supabaseConfigurado = urlConfigurada !== '' && chaveConfigurada !== '';

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

export const supabase = createClient(
  urlConfigurada || URL_RESERVA,
  chaveConfigurada || 'chave-nao-configurada',
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
  | 'audit_log';

/**
 * Helper para lidar com erros do Supabase de forma padronizada.
 */
export function handleSupabaseError(error: { message: string; code?: string } | null): void {
  if (!error) return;
  console.error(`[Supabase] ${error.code ?? 'ERR'}: ${error.message}`);
  throw new Error(error.message);
}
