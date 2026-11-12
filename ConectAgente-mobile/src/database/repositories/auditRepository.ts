import { getDatabase } from '../database';
import { generateUUID, isoNow } from '../../utils/formatters';
import { syncQueueRepository } from './syncQueueRepository';

/**
 * Trilha de auditoria da LGPD.
 *
 * Por que existe. O art. 37 da Lei 13.709/2018 obriga o controlador e o
 * operador a manter registro das operações de tratamento de dados pessoais.
 * Num sistema de saúde isso não é formalidade: é o que responde "quem abriu o
 * prontuário desta pessoa, e quando".
 *
 * O que havia antes: a tabela `audit_log` existia, o painel do gerente tinha
 * tela para ela, e um único evento era gravado, a troca de senha. Abrir
 * prontuário não deixava rastro nenhum. O próprio painel mostrava
 * "Entradas no audit log: 0" num banco com visita, morador e residência
 * cadastrados.
 *
 * Três decisões de desenho aqui:
 *
 * **Não guarda dado sensível.** O registro diz qual tabela e qual id foram
 * tocados, não o conteúdo. Uma trilha que copia o prontuário multiplica o
 * problema que deveria vigiar.
 *
 * **Falhar ao auditar não desfaz a operação.** Já houve um defeito assim
 * neste projeto: a auditoria quebrava por nome de coluna errado, a exceção
 * subia, e a tela dizia que a troca de senha não deu certo depois de ela ter
 * acontecido. O agente em campo não pode perder a visita registrada porque o
 * log falhou.
 *
 * **O vocabulário de `acao` é o mesmo que o painel do gerente desenha.**
 * Ação que o painel não conhece aparece com ícone genérico, então a lista
 * vive aqui e os ícones de lá seguem esta.
 */
export const ACOES_AUDITORIA = {
  /** Abriu o prontuário de um morador. Leitura de dado de saúde. */
  LEITURA: 'LEITURA',
  /** Criou registro. */
  INSERT: 'INSERT',
  /** Alterou registro. */
  UPDATE: 'UPDATE',
  /** Removeu registro. */
  DELETE: 'DELETE',
  /** Gerou arquivo com dado pessoal que sai do aparelho. */
  EXPORT: 'EXPORT',
  /** Entrou no sistema. */
  LOGIN: 'LOGIN',
  /** Trocou senha pela verificação de identidade. */
  RESET_SENHA: 'RESET_SENHA',
} as const;

export type AcaoAuditoria = (typeof ACOES_AUDITORIA)[keyof typeof ACOES_AUDITORIA];

export interface RegistroDeAuditoria {
  agenteId: string;
  acao: AcaoAuditoria;
  tabela: string;
  registroId: string;
  /** Contexto curto, sem dado pessoal. Vira JSON na coluna `dados_novos`. */
  contexto?: Record<string, string | number | boolean>;
}

export const auditRepository = {
  /**
   * Grava uma entrada. Nunca lança.
   *
   * Devolve `true` se gravou, e `false` se não deu. Quem chama pode ignorar o
   * retorno: a operação de negócio não depende dele. O retorno existe para o
   * teste conseguir afirmar alguma coisa.
   */
  async registrar(registro: RegistroDeAuditoria): Promise<boolean> {
    try {
      const db = await getDatabase();
      const id = generateUUID();
      const quando = isoNow();
      const contexto = registro.contexto ? JSON.stringify(registro.contexto) : null;

      await db.runAsync(
        `INSERT INTO audit_log (id, agente_id, acao, tabela, registro_id, dados_novos, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          registro.agenteId,
          registro.acao,
          registro.tabela,
          registro.registroId,
          contexto,
          quando,
        ]
      );

      // O administrador do aparelho não tem conta no servidor: a trilha dele
      // fica só aqui (Sistema → audit log). Na fila, ela nunca seria aceita e
      // deixaria o selo de pendências preso para sempre. Achado no aparelho.
      const autor = await db.getFirstAsync<{ is_admin: number }>(
        `SELECT is_admin FROM agentes WHERE id = ?`,
        [registro.agenteId]
      );
      if (autor?.is_admin === 1) return true;

      // A trilha do aparelho sobe para o servidor. A policy de la exige
      // `agente_id = auth.uid()`, entao o aparelho so consegue gravar evento
      // em nome de quem esta de fato autenticado: trilha vinda do cliente nao
      // vira porta para forjar acao de outro agente.
      await syncQueueRepository.enqueue('audit_log', 'insert', id, {
        id,
        agente_id: registro.agenteId,
        acao: registro.acao,
        tabela: registro.tabela,
        registro_id: registro.registroId,
        dados_novos: contexto,
        created_at: quando,
      });

      return true;
    } catch (erro) {
      // Sem `throw`: ver o cabeçalho deste arquivo.
      console.error('Falha ao registrar na auditoria:', erro);
      return false;
    }
  },

  /** Quantas entradas existem. Usado pelo painel e pelos testes. */
  async contar(): Promise<number> {
    try {
      const db = await getDatabase();
      const linha = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM audit_log`
      );
      return linha?.count ?? 0;
    } catch {
      return 0;
    }
  },
};
