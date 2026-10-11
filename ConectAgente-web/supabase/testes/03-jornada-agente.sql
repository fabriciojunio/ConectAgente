-- ===========================================================================
-- Jornada completa de um agente, do cadastro ao cancelamento
-- ===========================================================================
--
-- Reproduz, no banco de verdade, exatamente os payloads que o aplicativo
-- envia pela fila de sincronizacao, na ordem em que ele envia. Cada INSERT
-- aqui corresponde a uma chamada de `syncQueueRepository.enqueue` num
-- repositorio do aplicativo.
--
-- Por que SQL direto e nao teste de unidade: os defeitos que isto pega nao
-- existem em nenhum dos dois lados isoladamente. Cada camada estava
-- coerente consigo mesma. O que estava errado era a juncao, e so o banco de
-- verdade reclama.
--
-- O que este arquivo pegou quando foi escrito, tudo reproduzido:
--
--   column "status_sync" of relation "residencias" does not exist
--   column "motivo_visita" of relation "visitas" does not exist
--   insert or update on table "prontuario_saude" violates foreign key
--     constraint "prontuario_saude_prontuario_id_fkey"
--   new row for relation "agendamentos" violates check constraint
--     "agendamentos_status_check"
--   null value in column "meta" of relation "metas_visitas" violates
--     not-null constraint
--
-- Rodar por `rodar-testes-sync.sh`, que sobe um cluster descartavel, aplica
-- o schema e as migracoes, roda isto e destroi o cluster.
-- ===========================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- Agente que faz o trabalho
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO agentes (id, nome, cpf, email, senha_hash, area_atuacao, unidade_saude)
VALUES ('b0000000-0000-0000-0000-00000000000a', 'Ana Souza', '52998224725',
        'ana.souza@saude.bauru.sp.gov.br', 'hash-irrelevante-no-teste',
        'Microarea 3', 'UBS Centro')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 1. Cadastro de residencia
-- ─────────────────────────────────────────────────────────────────────
-- Payload de `residenciaRepository.criar`: o objeto local inteiro, menos
-- `status_sync`, que `prepararPayloadParaServidor` remove, mais o `id` que
-- o `syncService` injeta a partir de `registro_id`.
INSERT INTO residencias (
  id, cep, logradouro, numero, complemento, bairro, cidade, estado,
  tipo_imovel, num_comodos, tem_animais, animais_info,
  morador_responsavel_id, agente_id, created_at, updated_at
) VALUES (
  'b0000000-0000-0000-0000-000000000001', '17000100', 'Rua das Flores', '120',
  'Fundos', 'Jardim Europa', 'Bauru', 'SP', 'alugado', 4, true,
  '1 cachorro de pequeno porte', NULL,
  'b0000000-0000-0000-0000-00000000000a', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- ─────────────────────────────────────────────────────────────────────
-- 2. Cadastro de moradora
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO moradores (
  id, residencia_id, agente_id, nome, cpf, cartao_sus, data_nascimento,
  sexo, escolaridade, is_responsavel, telefone, created_at, updated_at
) VALUES (
  'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-00000000000a', 'Joana Ribeiro', '11144477735',
  '700000000000001', '1988-04-12', 'feminino', 'medio_completo', true,
  '14999990000', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- ─────────────────────────────────────────────────────────────────────
-- 3. Visita com todo o conteudo clinico
-- ─────────────────────────────────────────────────────────────────────
-- Estas oito colunas nao existiam no servidor. A visita era recusada
-- inteira, e com ela a pressao, a glicemia, o peso e o encaminhamento.
INSERT INTO visitas (
  id, residencia_id, morador_id, agente_id, data_visita, status,
  motivo_visita, queixas, observacoes,
  pa_visita, glicemia_visita, peso_visita,
  medicamentos_em_dia, cartao_vacinas_em_dia, encaminhamentos,
  precisa_agendamento, especialidade_agendamento, assinatura_base64,
  created_at, updated_at
) VALUES (
  'b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000a',
  NOW(), 'realizada',
  'Acompanhamento de hipertensao', 'Dor de cabeca ha tres dias',
  'Orientada sobre reducao de sal',
  '150/95', '118', '78',
  false, true, 'Encaminhada ao clinico geral',
  true, 'Cardiologia', 'data:image/png;base64,iVBORw0KGgo',
  NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- ─────────────────────────────────────────────────────────────────────
-- 4. Prontuario pai
-- ─────────────────────────────────────────────────────────────────────
-- `obterOuCriar` criava esta linha so no aparelho e nao a enfileirava. Sem
-- ela, as cinco sub-fichas abaixo batem na chave estrangeira.
INSERT INTO prontuarios (id, morador_id, agente_id, versao, created_at, updated_at)
VALUES ('b0000000-0000-0000-0000-000000000004',
        'b0000000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-00000000000a', 1, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET versao = prontuarios.versao + 1;

-- ─────────────────────────────────────────────────────────────────────
-- 5. As cinco sub-fichas, por UPSERT em prontuario_id
-- ─────────────────────────────────────────────────────────────────────
-- O aplicativo salva por substituicao (`salvarSaude` e irmas fazem
-- insere-ou-atualiza local). Como UPDATE puro, o primeiro envio afetaria
-- zero linhas sem devolver erro, e o dado se perderia em silencio.

INSERT INTO prontuario_saude (
  prontuario_id, is_hipertenso, is_diabetico, is_tuberculose, is_hanseniase,
  pa_ultima_afericao, pa_valor, hgt_ultima_afericao, hgt_valor,
  tem_receita_atualizada, ultima_consulta, proxima_consulta,
  precisa_agendamento, especialidade_agendamento, queixas, observacoes, updated_at
) VALUES (
  'b0000000-0000-0000-0000-000000000004', true, false, false, false,
  '2026-10-11', '150/95', '2026-10-11', '118',
  true, '2026-09-01', '2026-12-01',
  true, 'Cardiologia', 'Dor de cabeca', 'Em uso de losartana', NOW()
) ON CONFLICT (prontuario_id) DO UPDATE
  SET pa_valor = EXCLUDED.pa_valor, updated_at = NOW();

INSERT INTO prontuario_gestante (
  prontuario_id, is_gestante, data_dum, semanas_gestacao, pre_natal_em_dia,
  local_pre_natal, proxima_consulta_pre_natal, vacina_tetano_em_dia,
  vacina_hepatiteb_em_dia, sulfato_ferroso, acido_folico, observacoes, updated_at
) VALUES (
  'b0000000-0000-0000-0000-000000000004', true, '2026-05-10', 22, true,
  'UBS Centro', '2026-10-28', true, true, true, true,
  'Gestacao de baixo risco', NOW()
) ON CONFLICT (prontuario_id) DO UPDATE
  SET semanas_gestacao = EXCLUDED.semanas_gestacao;

INSERT INTO prontuario_puericultura (
  prontuario_id, is_crianca, peso_atual, altura_atual, cartao_vacina_em_dia,
  vacinas_em_atraso, consulta_acompanhamento_em_dia, proxima_consulta,
  frequenta_escola, nome_escola, observacoes, updated_at
) VALUES (
  'b0000000-0000-0000-0000-000000000004', false, NULL, NULL, true,
  NULL, true, NULL, false, NULL, NULL, NOW()
) ON CONFLICT (prontuario_id) DO UPDATE
  SET cartao_vacina_em_dia = EXCLUDED.cartao_vacina_em_dia;

INSERT INTO prontuario_mulher (
  prontuario_id, ultima_menstruacao, papanicolau_em_dia,
  data_ultimo_papanicolau, mamografia_em_dia, data_ultima_mamografia,
  usa_anticoncepcional, tipo_anticoncepcional, consulta_ginecologica_em_dia,
  prevencao_dts, observacoes, updated_at
) VALUES (
  'b0000000-0000-0000-0000-000000000004', '2026-05-10', true,
  '2026-03-15', false, NULL, true, 'Injetavel mensal', true,
  true, NULL, NOW()
) ON CONFLICT (prontuario_id) DO UPDATE
  SET papanicolau_em_dia = EXCLUDED.papanicolau_em_dia;

-- A ficha social e a que tem o dado mais sensivel do sistema.
INSERT INTO prontuario_social (
  prontuario_id, vulnerabilidade_social, descricao_vulnerabilidade,
  negligencia_parental, descricao_negligencia, violencia_domestica,
  descricao_violencia, depressao_suspeita, uso_alcool_drogas, descricao_uso,
  encaminhado_assistente_social, data_encaminhamento, observacoes, updated_at
) VALUES (
  'b0000000-0000-0000-0000-000000000004', 'alto',
  'Renda familiar abaixo de meio salario minimo',
  false, NULL, true, 'Relato da propria moradora', true, false, NULL,
  true, '2026-10-11', 'Caso em acompanhamento', NOW()
) ON CONFLICT (prontuario_id) DO UPDATE
  SET vulnerabilidade_social = EXCLUDED.vulnerabilidade_social;

-- ─────────────────────────────────────────────────────────────────────
-- 6. Agendamento e cancelamento
-- ─────────────────────────────────────────────────────────────────────
-- O insert nao levava `id`, entao o servidor gerava outro e cada
-- retentativa duplicava a linha. O cancelamento enviava 'cancelada', que o
-- CHECK antigo do servidor recusava.
INSERT INTO agendamentos (
  id, residencia_id, morador_id, agente_id, data_agendada, motivo,
  observacoes, created_at, updated_at
) VALUES (
  'b0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000000a',
  '2026-10-25', 'Retorno cardiologia', NULL, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

UPDATE agendamentos
   SET status = 'cancelada'
 WHERE id = 'b0000000-0000-0000-0000-000000000005';

-- ─────────────────────────────────────────────────────────────────────
-- 7. Meta do mes
-- ─────────────────────────────────────────────────────────────────────
-- `meta_total` no aparelho chega como `meta`, pela traducao declarada em
-- RENOMEAR_PARA_SERVIDOR. O conflito e pelo trio e nao pelo id, porque o
-- aparelho gera id novo a cada redefinicao da meta do mes.
INSERT INTO metas_visitas (agente_id, mes, ano, meta)
VALUES ('b0000000-0000-0000-0000-00000000000a', 10, 2026, 100)
ON CONFLICT (agente_id, mes, ano) DO UPDATE SET meta = EXCLUDED.meta;

-- Segunda definicao do mesmo mes: tem que atualizar, nao duplicar.
INSERT INTO metas_visitas (agente_id, mes, ano, meta)
VALUES ('b0000000-0000-0000-0000-00000000000a', 10, 2026, 120)
ON CONFLICT (agente_id, mes, ano) DO UPDATE SET meta = EXCLUDED.meta;

COMMIT;
