-- ===========================================================================
-- Cadastro público e aprovação no painel
-- ===========================================================================
--
-- Reproduz o caminho pelo qual um agente entra no sistema:
--
--   1. a pessoa se cadastra na tela pública (papel anon, sem login)
--   2. um gerente ou admin aprova no painel
--   3. a aprovação cria o usuário de autenticação e a linha em `agentes`
--
-- O que este arquivo pegou quando foi escrito, reproduzido num PostgreSQL
-- com o schema real:
--
--   new row for relation "solicitacoes_registro" violates check constraint
--     "solicitacoes_registro_cargo_pretendido_check"
--   new row for relation "agentes" violates check constraint
--     "agentes_role_check"
--
-- Havia cinco vocabulários diferentes para o mesmo campo. O formulário
-- oferecia "supervisor", que nenhum CHECK aceita, e a aprovação gravava
-- `role = 'supervisor'`, que o CHECK de `agentes.role` também recusa.
-- Resultado: nenhum agente conseguia ser provisionado pelo caminho previsto,
-- e sem linha em `agentes` com usuário de autenticação correspondente, o
-- aplicativo também não consegue sincronizar.
-- ===========================================================================

\set ON_ERROR_STOP on

BEGIN;

-- Quem aprova precisa existir antes.
INSERT INTO agentes (id, nome, cpf, email, senha_hash, area_atuacao, unidade_saude, role)
VALUES ('e0000000-0000-0000-0000-00000000000a', 'Gerente Davi', '11144477735',
        'davi@sms.gov.br', 'hash-irrelevante', 'Gestao', 'SMS', 'gerente')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 1. Cadastro público, com cada cargo que o formulário oferece
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO solicitacoes_registro
  (id, nome, cpf, telefone, area_atuacao, unidade_saude, cargo_pretendido, justificativa)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'Carla Lima', '52998224725', '14999990001',
   'Coordenacao', 'UBS Centro', 'coordenador', 'Coordeno a equipe da UBS Centro'),
  ('e0000000-0000-0000-0000-000000000002', 'Bruno Alves', '15350946056', '14999990002',
   'Gestao', 'SMS', 'gerente', 'Respondo pela gestao da rede'),
  ('e0000000-0000-0000-0000-000000000003', 'Diego Rocha', '28625587887', '14999990003',
   'Microarea 4', 'UBS Jardim', 'outro', 'Atuo como apoio administrativo')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Aprovação: o papel gravado precisa ser um dos quatro do CHECK
-- ─────────────────────────────────────────────────────────────────────
-- A regra do painel: 'coordenador' e 'gerente' recebem o papel pedido,
-- 'outro' recebe 'agente', que é o menor privilégio. Admin fica de fora:
-- só outro admin concede.
INSERT INTO agentes (id, nome, cpf, email, senha_hash, area_atuacao, unidade_saude, role)
VALUES
  ('e0000000-0000-0000-0000-00000000000b', 'Carla Lima', '52998224725',
   '52998224725@conectagente.local', 'hash', 'Coordenacao', 'UBS Centro', 'coordenador'),
  ('e0000000-0000-0000-0000-00000000000c', 'Bruno Alves', '15350946056',
   '15350946056@conectagente.local', 'hash', 'Gestao', 'SMS', 'gerente'),
  ('e0000000-0000-0000-0000-00000000000d', 'Diego Rocha', '28625587887',
   '28625587887@conectagente.local', 'hash', 'Microarea 4', 'UBS Jardim', 'agente')
ON CONFLICT (id) DO NOTHING;

UPDATE solicitacoes_registro
   SET status = 'aprovado',
       aprovado_por = 'e0000000-0000-0000-0000-00000000000a',
       aprovado_em = NOW()
 WHERE id IN ('e0000000-0000-0000-0000-000000000001',
              'e0000000-0000-0000-0000-000000000002',
              'e0000000-0000-0000-0000-000000000003');

COMMIT;
