import { createClient } from '@/lib/supabase/server';
import type { AuditLog } from '@/types';

/**
 * Registra uma ação de auditoria no banco de dados.
 * Utiliza o cliente Supabase do servidor para garantir segurança.
 *
 * @param acao Descrição da ação realizada
 * @param tabela Tabela afetada pela ação
 * @param registroId ID do registro afetado
 * @param dadosAnteriores Dados antes da alteração (opcional)
 * @param dadosNovos Dados após a alteração (opcional)
 */
export async function registrarAcao(
  acao: string,
  tabela: string,
  registroId: string,
  dadosAnteriores?: Record<string, unknown>,
  dadosNovos?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from('audit_log').insert({
      acao,
      tabela,
      registro_id: registroId,
      agente_id: user?.id ?? null,
      dados_anteriores: dadosAnteriores ?? null,
      dados_novos: dadosNovos ?? null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`Erro ao registrar ação de auditoria: ${error.message}`);
    }
  } catch (err) {
    // Não propaga erros de auditoria para não quebrar o fluxo principal.
    // Log no console para monitoramento.
    console.error(
      'Falha ao registrar auditoria:',
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Retorna os logs de auditoria mais recentes.
 * Utiliza o cliente Supabase do servidor.
 *
 * @param limit Número máximo de logs a retornar (padrão: 50)
 */
export async function getLogsRecentes(
  limit: number = 50
): Promise<AuditLog[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Erro ao buscar logs recentes: ${error.message}`);
    }

    return (data as AuditLog[]) ?? [];
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Erro inesperado ao buscar logs recentes');
  }
}
