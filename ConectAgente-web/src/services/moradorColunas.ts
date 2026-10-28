/**
 * Colunas de morador que o banco deixa ler direto.
 *
 * É a mesma lista do GRANT em `migration_colunas_sensiveis.sql`. Documento,
 * contato, filiação, doença, medicação, convênio, benefício e escolaridade
 * ficam de fora: saem só por `fn_ler_morador`, que registra quem leu (LGPD,
 * art. 37). Pedir todas as colunas de morador passou a ser recusado pelo
 * banco, por isso toda consulta de morador usa esta lista.
 */
export const MORADOR_COLUNAS_LISTA =
  'id, residencia_id, agente_id, nome, data_nascimento, sexo, is_responsavel, ' +
  'is_hipertenso, is_diabetico, is_gestante, is_domiciliado, tem_doenca, ' +
  'deleted_at, created_at, updated_at';
