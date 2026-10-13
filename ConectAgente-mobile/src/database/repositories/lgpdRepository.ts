import { getDatabase } from '../database';
import {
  anonimizarMorador,
  calcularDataExpiracao,
  criarConsentimento,
} from '../../utils/lgpd';
import { apenasData, isoNow } from '../../utils/formatters';
import { LGPD } from '../../utils/constants';
import type { Consentimento } from '../../types';
import { ACOES_AUDITORIA, auditRepository } from './auditRepository';

/**
 * Consentimento, anonimização e retenção.
 *
 * Por que este arquivo existe. `utils/lgpd.ts` tem `criarConsentimento`,
 * `anonimizarMorador` e `calcularDataExpiracao` desde o começo do projeto, e a
 * tabela `consentimentos` está no schema desde o começo também. Nenhuma tela
 * chamava nenhum dos três, e nenhuma linha era gravada. Função pronta e nunca
 * usada é o mesmo que não existir; aqui o que não existia era a prova de
 * consentimento, o direito à eliminação e o controle de prazo.
 *
 * As funções de `utils/lgpd.ts` continuam puras, montando objeto. Este
 * repositório é quem persiste. A separação é de propósito: o teste do formato
 * do consentimento não precisa de banco, e o teste da gravação não precisa
 * saber o formato.
 */

/**
 * Prazos de guarda.
 *
 * Vinte anos para dado de saúde segue a Resolução CFM 1.821/2007, que manda
 * guardar prontuário por no mínimo vinte anos a contar do último registro.
 * Cinco anos para o resto é o prazo geral de prescrição do Código Civil,
 * art. 206.
 *
 * Prazo vencido não apaga nada sozinho. O sistema só mostra o que passou do
 * prazo, e quem decide eliminar é gente: apagar prontuário por conta própria
 * é pior que guardar demais.
 */
export const RETENCAO_ANOS = { saude: 20, geral: 5 } as const;

export interface ItemExpirado {
  tabela: string;
  quantidade: number;
  anos: number;
  maisAntigo: string | null;
}

export const lgpdRepository = {
  // ==========================================================
  // CONSENTIMENTO
  // ==========================================================

  /**
   * Grava o consentimento colhido no cadastro do morador.
   *
   * O aceite acontece na tela de cadastro, onde o texto da finalidade e a
   * base legal aparecem. O que fica guardado é o que a lei pede para provar
   * o aceite: quando foi, de que versão da política, e quais dados.
   */
  async registrarConsentimento(params: {
    moradorId: string;
    tipo?: string;
    aceito?: boolean;
    dadosColetados: string[];
  }): Promise<Consentimento | null> {
    const consentimento = criarConsentimento({
      morador_id: params.moradorId,
      tipo: params.tipo ?? LGPD.TIPOS_CONSENTIMENTO.DADOS_SAUDE,
      aceito: params.aceito ?? true,
      dados_coletados: params.dadosColetados,
    });

    try {
      const db = await getDatabase();
      await db.runAsync(
        `INSERT INTO consentimentos
           (id, morador_id, tipo, aceito, versao_politica, data_aceite, dados_coletados)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          consentimento.id,
          consentimento.morador_id,
          consentimento.tipo,
          consentimento.aceito ? 1 : 0,
          consentimento.versao_politica,
          consentimento.data_aceite,
          consentimento.dados_coletados,
        ]
      );
      return consentimento;
    } catch (erro) {
      // Mesma regra da auditoria: não derruba o cadastro que já aconteceu.
      console.error('Falha ao registrar consentimento:', erro);
      return null;
    }
  },

  /** Consentimentos de um morador, do mais recente para o mais antigo. */
  async consentimentosDe(moradorId: string): Promise<Consentimento[]> {
    const db = await getDatabase();
    const linhas = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM consentimentos WHERE morador_id = ? ORDER BY data_aceite DESC`,
      [moradorId]
    );
    return linhas.map((l) => ({
      ...l,
      aceito: l.aceito === 1 || l.aceito === true,
    })) as unknown as Consentimento[];
  },

  /**
   * Registra a revogação do consentimento.
   *
   * Revogar não apaga o registro anterior: grava um novo, com `aceito` falso.
   * Apagar o aceite tiraria justamente a prova de que ele existiu, e a lei
   * pede o histórico, não o estado final.
   */
  async revogarConsentimento(moradorId: string, tipo?: string): Promise<boolean> {
    const novo = await this.registrarConsentimento({
      moradorId,
      tipo,
      aceito: false,
      dadosColetados: [],
    });
    return novo !== null;
  },

  // ==========================================================
  // ANONIMIZAÇÃO (art. 18, IV)
  // ==========================================================

  /**
   * Apaga a identificação de um morador, mantendo o registro estatístico.
   *
   * Não é DELETE. O atendimento aconteceu, e a unidade precisa do número para
   * prestação de contas; o que a pessoa tem direito de tirar é o vínculo com
   * ela. Então nome, CPF, cartão SUS, telefone, filiação e data de nascimento
   * viram valores neutros, e `deleted_at` marca a saída.
   *
   * Fica na trilha de auditoria, porque anonimizar é operação de tratamento
   * como qualquer outra, e precisa ser atribuível a quem mandou fazer.
   */
  async anonimizar(moradorId: string, agenteId: string): Promise<boolean> {
    const db = await getDatabase();

    const atual = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM moradores WHERE id = ?`,
      [moradorId]
    );
    if (!atual) return false;

    const anonimo = anonimizarMorador(atual);

    await db.runAsync(
      `UPDATE moradores SET
         nome = ?, cpf = ?, cartao_sus = ?, telefone = ?,
         nome_pai = ?, nome_mae = ?, data_nascimento = ?,
         cidade_nascimento = ?, profissao = ?,
         deleted_at = ?, updated_at = ?
       WHERE id = ?`,
      [
        anonimo.nome as string,
        anonimo.cpf as string,
        anonimo.cartao_sus as string,
        null,
        null,
        null,
        anonimo.data_nascimento as string,
        null,
        null,
        anonimo.deleted_at as string,
        isoNow(),
        moradorId,
      ]
    );

    void auditRepository.registrar({
      agenteId,
      acao: ACOES_AUDITORIA.DELETE,
      tabela: 'moradores',
      registroId: moradorId,
      contexto: { motivo: 'anonimizacao a pedido do titular' },
    });

    return true;
  },

  // ==========================================================
  // RETENÇÃO
  // ==========================================================

  /**
   * A data em que um registro criado hoje vence.
   *
   * Existe para a tela conseguir dizer "este dado será guardado até", que é o
   * que o art. 9º pede: informação clara sobre a duração do tratamento.
   */
  vencimentoDe(tipo: 'saude' | 'geral'): string {
    return calcularDataExpiracao(tipo);
  },

  /**
   * O que já passou do prazo de guarda.
   *
   * Conta, não apaga. A decisão de eliminar é de quem responde pelo serviço,
   * e um sistema que apaga prontuário sozinho é pior que um que guarda demais.
   */
  async levantarVencidos(): Promise<ItemExpirado[]> {
    const db = await getDatabase();

    const limite = (anos: number) => {
      const d = new Date();
      d.setFullYear(d.getFullYear() - anos);
      return apenasData(d);
    };

    const consultas: Array<{ tabela: string; anos: number; coluna: string }> = [
      { tabela: 'visitas', anos: RETENCAO_ANOS.saude, coluna: 'data_visita' },
      { tabela: 'moradores', anos: RETENCAO_ANOS.saude, coluna: 'created_at' },
      { tabela: 'agendamentos', anos: RETENCAO_ANOS.geral, coluna: 'data_agendada' },
    ];

    const saida: ItemExpirado[] = [];
    for (const { tabela, anos, coluna } of consultas) {
      try {
        const linha = await db.getFirstAsync<{ quantidade: number; mais_antigo: string | null }>(
          `SELECT COUNT(*) as quantidade, MIN(${coluna}) as mais_antigo
             FROM ${tabela} WHERE ${coluna} < ?`,
          [limite(anos)]
        );
        saida.push({
          tabela,
          anos,
          quantidade: linha?.quantidade ?? 0,
          maisAntigo: linha?.mais_antigo ?? null,
        });
      } catch (erro) {
        console.error(`Falha ao levantar vencidos de ${tabela}:`, erro);
        saida.push({ tabela, anos, quantidade: 0, maisAntigo: null });
      }
    }
    return saida;
  },
};
