import { createClient } from '@/lib/supabase/server';

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
