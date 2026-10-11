-- Cenário de teste: duas unidades de saúde, três agentes, dois pacientes.
-- O objetivo é ter dado de um agente que o outro NÃO pode ver.

TRUNCATE prontuario_saude, prontuarios, moradores, residencias, agentes,
         audit_log RESTART IDENTITY CASCADE;

-- Agentes -------------------------------------------------------------------
INSERT INTO agentes (id, nome, cpf, email, senha_hash, area_atuacao, unidade_saude, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Agente Ana',   '11111111111', 'ana@ubs.gov.br',
   '$2b$12$hashSuperSecretoDaAna',   'Microárea 1', 'UBS Centro',  'agente'),
  ('22222222-2222-2222-2222-222222222222', 'Agente Bruno', '22222222222', 'bruno@ubs.gov.br',
   '$2b$12$hashSuperSecretoDoBruno', 'Microárea 2', 'UBS Jardim',  'agente'),
  ('33333333-3333-3333-3333-333333333333', 'Coord Carla',  '33333333333', 'carla@ubs.gov.br',
   '$2b$12$hashSuperSecretoDaCarla', 'Coordenação',  'UBS Centro',  'coordenador'),
  ('44444444-4444-4444-4444-444444444444', 'Gerente Davi', '44444444444', 'davi@sms.gov.br',
   '$2b$12$hashSuperSecretoDoDavi',  'Gestão',       'SMS',         'gerente');

-- Residências ---------------------------------------------------------------
INSERT INTO residencias (id, agente_id, cep, logradouro, numero, bairro, cidade, estado) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   '17000000', 'Rua das Flores', '100', 'Centro', 'Bauru', 'SP'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
   '17010000', 'Rua dos Ipês',   '200', 'Jardim', 'Bauru', 'SP');

-- Moradores -----------------------------------------------------------------
INSERT INTO moradores (id, residencia_id, agente_id, nome, cpf, data_nascimento) VALUES
  ('aaaaaaaa-1111-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'Paciente da Ana',   '55555555555', '1980-01-01'),
  ('bbbbbbbb-2222-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222', 'Paciente do Bruno', '66666666666', '1990-02-02');

-- Prontuários ---------------------------------------------------------------
INSERT INTO prontuarios (id, morador_id, agente_id) VALUES
  ('aaaaaaaa-3333-0000-0000-000000000001', 'aaaaaaaa-1111-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-4444-0000-0000-000000000002', 'bbbbbbbb-2222-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222');

-- Dado de saúde: é isto que a LGPD classifica como sensível ------------------
INSERT INTO prontuario_saude (prontuario_id, peso_kg, altura_cm, pressao_arterial,
                              glicemia, tipo_sanguineo, alergias, is_hipertenso, is_diabetico) VALUES
  ('aaaaaaaa-3333-0000-0000-000000000001', 82.5, 170, '150/95', 210.0, 'O+',
   'Penicilina', true, true),
  ('bbbbbbbb-4444-0000-0000-000000000002', 61.0, 165, '120/80', 95.0,  'A-',
   'Nenhuma', false, false);

-- Permissões de tabela como o Supabase entrega ------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO anon, authenticated;
