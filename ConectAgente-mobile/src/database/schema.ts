/**
 * Schema do banco de dados SQLite local (offline-first).
 * Todas as tabelas têm status_sync para controle de sincronização
 * e deleted_at para soft delete (LGPD).
 */

export const CREATE_TABLES_SQL = `
  -- Agentes (usuários do sistema)
  CREATE TABLE IF NOT EXISTS agentes (
    id TEXT PRIMARY KEY NOT NULL,
    nome TEXT NOT NULL,
    cpf TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    telefone TEXT,
    area_atuacao TEXT NOT NULL,
    unidade_saude TEXT NOT NULL,
    ativo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Residências
  CREATE TABLE IF NOT EXISTS residencias (
    id TEXT PRIMARY KEY NOT NULL,
    cep TEXT NOT NULL,
    logradouro TEXT NOT NULL,
    numero TEXT NOT NULL,
    complemento TEXT,
    bairro TEXT NOT NULL,
    cidade TEXT NOT NULL,
    estado TEXT NOT NULL,
    tipo_imovel TEXT NOT NULL DEFAULT 'proprio',
    num_comodos INTEGER NOT NULL DEFAULT 1,
    tem_animais INTEGER NOT NULL DEFAULT 0,
    animais_info TEXT,
    morador_responsavel_id TEXT,
    agente_id TEXT NOT NULL,
    status_sync TEXT NOT NULL DEFAULT 'pendente',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (agente_id) REFERENCES agentes(id)
  );

  -- Moradores / Pacientes
  CREATE TABLE IF NOT EXISTS moradores (
    id TEXT PRIMARY KEY NOT NULL,
    residencia_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    cpf TEXT,
    cartao_sus TEXT,
    telefone TEXT,
    data_nascimento TEXT NOT NULL,
    cidade_nascimento TEXT,
    nome_pai TEXT,
    nome_mae TEXT,
    sexo TEXT NOT NULL,
    escolaridade TEXT,
    profissao TEXT,
    tem_doenca INTEGER NOT NULL DEFAULT 0,
    doencas TEXT,
    beneficio_bolsa_familia INTEGER NOT NULL DEFAULT 0,
    tem_convenio INTEGER NOT NULL DEFAULT 0,
    convenio_nome TEXT,
    toma_medicamento INTEGER NOT NULL DEFAULT 0,
    medicamentos_lista TEXT,
    is_responsavel INTEGER NOT NULL DEFAULT 0,
    agente_id TEXT NOT NULL,
    status_sync TEXT NOT NULL DEFAULT 'pendente',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (residencia_id) REFERENCES residencias(id),
    FOREIGN KEY (agente_id) REFERENCES agentes(id)
  );

  -- Prontuários (cabeçalho)
  CREATE TABLE IF NOT EXISTS prontuarios (
    id TEXT PRIMARY KEY NOT NULL,
    morador_id TEXT NOT NULL UNIQUE,
    agente_id TEXT NOT NULL,
    versao INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    status_sync TEXT NOT NULL DEFAULT 'pendente',
    FOREIGN KEY (morador_id) REFERENCES moradores(id),
    FOREIGN KEY (agente_id) REFERENCES agentes(id)
  );

  -- Prontuário - Saúde geral
  CREATE TABLE IF NOT EXISTS prontuario_saude (
    id TEXT PRIMARY KEY NOT NULL,
    prontuario_id TEXT NOT NULL UNIQUE,
    is_hipertenso INTEGER NOT NULL DEFAULT 0,
    is_diabetico INTEGER NOT NULL DEFAULT 0,
    is_domiciliado INTEGER NOT NULL DEFAULT 0,
    is_tuberculose INTEGER NOT NULL DEFAULT 0,
    is_hanseniase INTEGER NOT NULL DEFAULT 0,
    hgt_ultima_afericao TEXT,
    hgt_valor TEXT,
    pa_ultima_afericao TEXT,
    pa_valor TEXT,
    tem_receita_atualizada INTEGER NOT NULL DEFAULT 0,
    ultima_consulta TEXT,
    proxima_consulta TEXT,
    precisa_agendamento INTEGER NOT NULL DEFAULT 0,
    especialidade_agendamento TEXT,
    queixas TEXT,
    observacoes TEXT,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (prontuario_id) REFERENCES prontuarios(id)
  );

  -- Prontuário - Gestante
  CREATE TABLE IF NOT EXISTS prontuario_gestante (
    id TEXT PRIMARY KEY NOT NULL,
    prontuario_id TEXT NOT NULL UNIQUE,
    is_gestante INTEGER NOT NULL DEFAULT 0,
    data_dum TEXT,
    semanas_gestacao INTEGER,
    pre_natal_em_dia INTEGER NOT NULL DEFAULT 0,
    local_pre_natal TEXT,
    proxima_consulta_pre_natal TEXT,
    vacina_tetano_em_dia INTEGER NOT NULL DEFAULT 0,
    vacina_hepatiteb_em_dia INTEGER NOT NULL DEFAULT 0,
    sulfato_ferroso INTEGER NOT NULL DEFAULT 0,
    acido_folico INTEGER NOT NULL DEFAULT 0,
    observacoes TEXT,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (prontuario_id) REFERENCES prontuarios(id)
  );

  -- Prontuário - Puericultura (crianças até 2 anos)
  CREATE TABLE IF NOT EXISTS prontuario_puericultura (
    id TEXT PRIMARY KEY NOT NULL,
    prontuario_id TEXT NOT NULL UNIQUE,
    is_crianca INTEGER NOT NULL DEFAULT 0,
    peso_atual TEXT,
    altura_atual TEXT,
    cartao_vacina_em_dia INTEGER NOT NULL DEFAULT 0,
    vacinas_em_atraso TEXT,
    consulta_acompanhamento_em_dia INTEGER NOT NULL DEFAULT 0,
    proxima_consulta TEXT,
    frequenta_escola INTEGER NOT NULL DEFAULT 0,
    nome_escola TEXT,
    observacoes TEXT,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (prontuario_id) REFERENCES prontuarios(id)
  );

  -- Prontuário - Mulher
  CREATE TABLE IF NOT EXISTS prontuario_mulher (
    id TEXT PRIMARY KEY NOT NULL,
    prontuario_id TEXT NOT NULL UNIQUE,
    ultima_menstruacao TEXT,
    papanicolau_em_dia INTEGER NOT NULL DEFAULT 0,
    data_ultimo_papanicolau TEXT,
    mamografia_em_dia INTEGER NOT NULL DEFAULT 0,
    data_ultima_mamografia TEXT,
    usa_anticoncepcional INTEGER NOT NULL DEFAULT 0,
    tipo_anticoncepcional TEXT,
    consulta_ginecologica_em_dia INTEGER NOT NULL DEFAULT 0,
    prevencao_dts INTEGER NOT NULL DEFAULT 0,
    observacoes TEXT,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (prontuario_id) REFERENCES prontuarios(id)
  );

  -- Prontuário - Social (vulnerabilidade, violência, etc.)
  CREATE TABLE IF NOT EXISTS prontuario_social (
    id TEXT PRIMARY KEY NOT NULL,
    prontuario_id TEXT NOT NULL UNIQUE,
    vulnerabilidade_social TEXT NOT NULL DEFAULT 'nenhum',
    descricao_vulnerabilidade TEXT,
    negligencia_parental INTEGER NOT NULL DEFAULT 0,
    descricao_negligencia TEXT,
    violencia_domestica INTEGER NOT NULL DEFAULT 0,
    descricao_violencia TEXT,
    depressao_suspeita INTEGER NOT NULL DEFAULT 0,
    uso_alcool_drogas INTEGER NOT NULL DEFAULT 0,
    descricao_uso TEXT,
    encaminhado_assistente_social INTEGER NOT NULL DEFAULT 0,
    data_encaminhamento TEXT,
    observacoes TEXT,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (prontuario_id) REFERENCES prontuarios(id)
  );

  -- Medicamentos e dúvidas
  CREATE TABLE IF NOT EXISTS medicamentos (
    id TEXT PRIMARY KEY NOT NULL,
    morador_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    dosagem TEXT,
    frequencia TEXT,
    duvida TEXT,
    duvida_respondida INTEGER NOT NULL DEFAULT 0,
    resposta_medico TEXT,
    data_resposta TEXT,
    agente_id TEXT NOT NULL,
    status_sync TEXT NOT NULL DEFAULT 'pendente',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (morador_id) REFERENCES moradores(id)
  );

  -- Vacinas
  CREATE TABLE IF NOT EXISTS vacinas (
    id TEXT PRIMARY KEY NOT NULL,
    morador_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    data_aplicacao TEXT,
    proxima_dose TEXT,
    local_aplicacao TEXT,
    lote TEXT,
    observacoes TEXT,
    agente_id TEXT NOT NULL,
    status_sync TEXT NOT NULL DEFAULT 'pendente',
    created_at TEXT NOT NULL,
    FOREIGN KEY (morador_id) REFERENCES moradores(id)
  );

  -- Receitas médicas
  CREATE TABLE IF NOT EXISTS receitas (
    id TEXT PRIMARY KEY NOT NULL,
    morador_id TEXT NOT NULL,
    medico TEXT NOT NULL,
    data_receita TEXT NOT NULL,
    data_validade TEXT,
    medicamentos_receita TEXT NOT NULL,
    entregue INTEGER NOT NULL DEFAULT 0,
    data_entrega TEXT,
    observacoes TEXT,
    agente_id TEXT NOT NULL,
    status_sync TEXT NOT NULL DEFAULT 'pendente',
    created_at TEXT NOT NULL,
    FOREIGN KEY (morador_id) REFERENCES moradores(id)
  );

  -- Visitas
  CREATE TABLE IF NOT EXISTS visitas (
    id TEXT PRIMARY KEY NOT NULL,
    residencia_id TEXT NOT NULL,
    morador_id TEXT,
    agente_id TEXT NOT NULL,
    data_visita TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'realizada',
    motivo_visita TEXT,
    queixas TEXT,
    observacoes TEXT,
    pa_visita TEXT,
    glicemia_visita TEXT,
    peso_visita TEXT,
    medicamentos_em_dia INTEGER,
    cartao_vacinas_em_dia INTEGER,
    encaminhamentos TEXT,
    precisa_agendamento INTEGER NOT NULL DEFAULT 0,
    especialidade_agendamento TEXT,
    assinatura_base64 TEXT,
    status_sync TEXT NOT NULL DEFAULT 'pendente',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (residencia_id) REFERENCES residencias(id),
    FOREIGN KEY (agente_id) REFERENCES agentes(id)
  );

  -- Agendamentos
  CREATE TABLE IF NOT EXISTS agendamentos (
    id TEXT PRIMARY KEY NOT NULL,
    residencia_id TEXT NOT NULL,
    morador_id TEXT,
    agente_id TEXT NOT NULL,
    data_agendada TEXT NOT NULL,
    motivo TEXT NOT NULL,
    observacoes TEXT,
    status TEXT NOT NULL DEFAULT 'agendada',
    status_sync TEXT NOT NULL DEFAULT 'pendente',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (residencia_id) REFERENCES residencias(id),
    FOREIGN KEY (agente_id) REFERENCES agentes(id)
  );

  -- Metas de visita por mês
  CREATE TABLE IF NOT EXISTS metas_visitas (
    id TEXT PRIMARY KEY NOT NULL,
    agente_id TEXT NOT NULL,
    mes INTEGER NOT NULL,
    ano INTEGER NOT NULL,
    meta_total INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE(agente_id, mes, ano),
    FOREIGN KEY (agente_id) REFERENCES agentes(id)
  );

  -- Fila de sincronização (offline-first)
  CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY NOT NULL,
    tabela TEXT NOT NULL,
    operacao TEXT NOT NULL,
    registro_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    tentativas INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pendente',
    erro TEXT,
    created_at TEXT NOT NULL
  );

  -- Log de auditoria (LGPD)
  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY NOT NULL,
    agente_id TEXT NOT NULL,
    acao TEXT NOT NULL,
    tabela TEXT NOT NULL,
    registro_id TEXT NOT NULL,
    dados_anteriores TEXT,
    dados_novos TEXT,
    created_at TEXT NOT NULL
  );

  -- Consentimentos LGPD
  CREATE TABLE IF NOT EXISTS consentimentos (
    id TEXT PRIMARY KEY NOT NULL,
    morador_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    aceito INTEGER NOT NULL DEFAULT 1,
    versao_politica TEXT NOT NULL,
    data_aceite TEXT NOT NULL,
    dados_coletados TEXT NOT NULL,
    FOREIGN KEY (morador_id) REFERENCES moradores(id)
  );

  -- Índices para performance
  CREATE INDEX IF NOT EXISTS idx_moradores_residencia ON moradores(residencia_id);
  CREATE INDEX IF NOT EXISTS idx_moradores_cpf ON moradores(cpf);
  CREATE INDEX IF NOT EXISTS idx_moradores_cartao_sus ON moradores(cartao_sus);
  CREATE INDEX IF NOT EXISTS idx_visitas_agente ON visitas(agente_id);
  CREATE INDEX IF NOT EXISTS idx_visitas_data ON visitas(data_visita);
  CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data_agendada);
  CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
  CREATE INDEX IF NOT EXISTS idx_residencias_agente ON residencias(agente_id);
`;
