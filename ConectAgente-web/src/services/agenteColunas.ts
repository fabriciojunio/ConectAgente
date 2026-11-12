/**
 * Colunas de agente que o painel pode ler.
 *
 * `senha_hash` é fechada para leitura desde migration_colunas_sensiveis.sql,
 * e pedir `*` em `agentes` faz o banco recusar a consulta inteira (403,
 * "permission denied for table agentes"). Era o que deixava a tela de
 * Agentes e a de Usuários vazias. Toda consulta de agente usa esta lista.
 */
export const AGENTE_COLUNAS_LISTA =
  'id, nome, cpf, email, telefone, area_atuacao, unidade_saude, microarea, role, ativo, created_at, updated_at';
