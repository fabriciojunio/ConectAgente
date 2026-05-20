// ============================================================
// ENUMS
// ============================================================

export enum Sexo {
  MASCULINO = 'masculino',
  FEMININO = 'feminino',
  OUTRO = 'outro',
}

export enum TipoImovel {
  PROPRIO = 'proprio',
  ALUGADO = 'alugado',
  CEDIDO = 'cedido',
  OUTROS = 'outros',
}

export enum Escolaridade {
  SEM_ESCOLARIDADE = 'sem_escolaridade',
  FUNDAMENTAL_INCOMPLETO = 'fundamental_incompleto',
  FUNDAMENTAL_COMPLETO = 'fundamental_completo',
  MEDIO_INCOMPLETO = 'medio_incompleto',
  MEDIO_COMPLETO = 'medio_completo',
  SUPERIOR_INCOMPLETO = 'superior_incompleto',
  SUPERIOR_COMPLETO = 'superior_completo',
  POS_GRADUACAO = 'pos_graduacao',
}

export enum StatusVisita {
  AGENDADA = 'agendada',
  REALIZADA = 'realizada',
  CANCELADA = 'cancelada',
  NAO_ENCONTRADO = 'nao_encontrado',
}

export enum StatusSync {
  PENDENTE = 'pendente',
  SINCRONIZADO = 'sincronizado',
  ERRO = 'erro',
}

export enum OperacaoSync {
  INSERT = 'insert',
  UPDATE = 'update',
  DELETE = 'delete',
}

export enum NivelVulnerabilidade {
  NENHUM = 'nenhum',
  BAIXO = 'baixo',
  MEDIO = 'medio',
  ALTO = 'alto',
  CRITICO = 'critico',
}

// ============================================================
// AGENTE (Usuário do sistema)
// ============================================================

export interface Agente {
  id: string;
  nome: string;
  cpf: string;
  email: string;
  telefone?: string;
  area_atuacao: string;
  unidade_saude: string;
  ativo: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgenteCadastro {
  nome: string;
  cpf: string;
  email: string;
  senha: string;
  telefone?: string;
  area_atuacao: string;
  unidade_saude: string;
}

export interface AgenteLogin {
  cpf: string;
  senha: string;
}

export interface AuthToken {
  token: string;
  refresh_token: string;
  expires_at: string;
  agente: Agente;
}

// ============================================================
// RESIDÊNCIA
// ============================================================

export interface Residencia {
  id: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  tipo_imovel: TipoImovel;
  num_comodos: number;
  tem_animais: boolean;
  animais_info?: string;
  morador_responsavel_id?: string;
  agente_id: string;
  status_sync: StatusSync;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface ResidenciaFormData {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  tipo_imovel: TipoImovel;
  num_comodos: number;
  tem_animais: boolean;
  animais_info?: string;
}

// ============================================================
// MORADOR / PACIENTE
// ============================================================

export interface Morador {
  id: string;
  residencia_id: string;
  nome: string;
  cpf?: string;
  cartao_sus?: string;
  telefone?: string;
  data_nascimento: string;
  cidade_nascimento?: string;
  nome_pai?: string;
  nome_mae?: string;
  sexo: Sexo;
  escolaridade?: Escolaridade;
  profissao?: string;
  tem_doenca: boolean;
  doencas?: string;
  beneficio_bolsa_familia: boolean;
  tem_convenio: boolean;
  convenio_nome?: string;
  toma_medicamento: boolean;
  medicamentos_lista?: string;
  is_responsavel: boolean;
  agente_id: string;
  status_sync: StatusSync;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface MoradorFormData {
  residencia_id: string;
  nome: string;
  cpf?: string;
  cartao_sus?: string;
  telefone?: string;
  data_nascimento: string;
  cidade_nascimento?: string;
  nome_pai?: string;
  nome_mae?: string;
  sexo: Sexo;
  escolaridade?: Escolaridade;
  profissao?: string;
  tem_doenca: boolean;
  doencas?: string;
  beneficio_bolsa_familia: boolean;
  tem_convenio: boolean;
  convenio_nome?: string;
  toma_medicamento: boolean;
  medicamentos_lista?: string;
  is_responsavel: boolean;
}

// ============================================================
// PRONTUÁRIO
// ============================================================

export interface Prontuario {
  id: string;
  morador_id: string;
  agente_id: string;
  versao: number;
  created_at: string;
  updated_at: string;
  status_sync: StatusSync;
  saude?: ProntuarioSaude;
  gestante?: ProntuarioGestante;
  puericultura?: ProntuarioPuericultura;
  mulher?: ProntuarioMulher;
  social?: ProntuarioSocial;
}

export interface ProntuarioSaude {
  id: string;
  prontuario_id: string;
  is_hipertenso: boolean;
  is_diabetico: boolean;
  is_domiciliado: boolean;
  is_tuberculose: boolean;
  is_hanseniase: boolean;
  hgt_ultima_aferição?: string;
  hgt_valor?: string;
  pa_ultima_aferição?: string;
  pa_valor?: string;
  tem_receita_atualizada: boolean;
  ultima_consulta?: string;
  proxima_consulta?: string;
  precisa_agendamento: boolean;
  especialidade_agendamento?: string;
  queixas?: string;
  observacoes?: string;
  updated_at: string;
}

export interface ProntuarioGestante {
  id: string;
  prontuario_id: string;
  is_gestante: boolean;
  data_dum?: string;
  semanas_gestacao?: number;
  pre_natal_em_dia: boolean;
  local_pre_natal?: string;
  proxima_consulta_pre_natal?: string;
  vacina_tetano_em_dia: boolean;
  vacina_hepatiteb_em_dia: boolean;
  sulfato_ferroso: boolean;
  acido_folico: boolean;
  observacoes?: string;
  updated_at: string;
}

export interface ProntuarioPuericultura {
  id: string;
  prontuario_id: string;
  is_crianca: boolean;
  peso_atual?: string;
  altura_atual?: string;
  cartao_vacina_em_dia: boolean;
  vacinas_em_atraso?: string;
  consulta_acompanhamento_em_dia: boolean;
  proxima_consulta?: string;
  frequenta_escola: boolean;
  nome_escola?: string;
  observacoes?: string;
  updated_at: string;
}

export interface ProntuarioMulher {
  id: string;
  prontuario_id: string;
  ultima_menstruacao?: string;
  papanicolau_em_dia: boolean;
  data_ultimo_papanicolau?: string;
  mamografia_em_dia: boolean;
  data_ultima_mamografia?: string;
  usa_anticoncepcional: boolean;
  tipo_anticoncepcional?: string;
  consulta_ginecologica_em_dia: boolean;
  prevencao_dts: boolean;
  observacoes?: string;
  updated_at: string;
}

export interface ProntuarioSocial {
  id: string;
  prontuario_id: string;
  vulnerabilidade_social: NivelVulnerabilidade;
  descricao_vulnerabilidade?: string;
  negligencia_parental: boolean;
  descricao_negligencia?: string;
  violencia_domestica: boolean;
  descricao_violencia?: string;
  depressao_suspeita: boolean;
  uso_alcool_drogas: boolean;
  descricao_uso?: string;
  encaminhado_assistente_social: boolean;
  data_encaminhamento?: string;
  observacoes?: string;
  updated_at: string;
}

// ============================================================
// MEDICAMENTO / DÚVIDA
// ============================================================

export interface Medicamento {
  id: string;
  morador_id: string;
  nome: string;
  dosagem?: string;
  frequencia?: string;
  duvida?: string;
  duvida_respondida: boolean;
  resposta_medico?: string;
  data_resposta?: string;
  agente_id: string;
  status_sync: StatusSync;
  created_at: string;
  updated_at: string;
}

// ============================================================
// VACINA
// ============================================================

export interface Vacina {
  id: string;
  morador_id: string;
  nome: string;
  data_aplicacao?: string;
  proxima_dose?: string;
  local_aplicacao?: string;
  lote?: string;
  observacoes?: string;
  agente_id: string;
  status_sync: StatusSync;
  created_at: string;
}

// ============================================================
// RECEITA
// ============================================================

export interface Receita {
  id: string;
  morador_id: string;
  medico: string;
  data_receita: string;
  data_validade?: string;
  medicamentos_receita: string;
  entregue: boolean;
  data_entrega?: string;
  observacoes?: string;
  agente_id: string;
  status_sync: StatusSync;
  created_at: string;
}

// ============================================================
// VISITA
// ============================================================

export interface Visita {
  id: string;
  residencia_id: string;
  morador_id?: string;
  agente_id: string;
  data_visita: string;
  status: StatusVisita;
  motivo_visita?: string;
  queixas?: string;
  observacoes?: string;
  pa_visita?: string;
  glicemia_visita?: string;
  peso_visita?: string;
  medicamentos_em_dia?: boolean;
  cartao_vacinas_em_dia?: boolean;
  encaminhamentos?: string;
  precisa_agendamento: boolean;
  especialidade_agendamento?: string;
  assinatura_base64?: string;
  created_at: string;
  updated_at: string;
  status_sync: StatusSync;
  residencia?: Residencia;
  morador?: Morador;
}

export interface VisitaFormData {
  residencia_id: string;
  morador_id?: string;
  data_visita: string;
  status: StatusVisita;
  motivo_visita?: string;
  queixas?: string;
  observacoes?: string;
  pa_visita?: string;
  glicemia_visita?: string;
  peso_visita?: string;
  medicamentos_em_dia?: boolean;
  cartao_vacinas_em_dia?: boolean;
  encaminhamentos?: string;
  precisa_agendamento: boolean;
  especialidade_agendamento?: string;
}

// ============================================================
// AGENDAMENTO
// ============================================================

export interface Agendamento {
  id: string;
  residencia_id: string;
  morador_id?: string;
  agente_id: string;
  data_agendada: string;
  motivo: string;
  observacoes?: string;
  status: StatusVisita;
  created_at: string;
  updated_at: string;
  status_sync: StatusSync;
  residencia?: Residencia;
  morador?: Morador;
}

// ============================================================
// METAS
// ============================================================

export interface MetaVisita {
  id: string;
  agente_id: string;
  mes: number;
  ano: number;
  meta_total: number;
  created_at: string;
}

export interface EstatisticasVisitas {
  total_realizadas: number;
  total_agendadas: number;
  meta_mensal: number;
  realizadas_hoje: number;
  realizadas_semana: number;
  realizadas_mes: number;
  percentual_meta: number;
}

// ============================================================
// SYNC QUEUE
// ============================================================

export interface SyncQueueItem {
  id: string;
  tabela: string;
  operacao: OperacaoSync;
  registro_id: string;
  payload: string;
  tentativas: number;
  status: StatusSync;
  erro?: string;
  created_at: string;
}

// ============================================================
// AUDIT LOG (LGPD)
// ============================================================

export interface AuditLog {
  id: string;
  agente_id: string;
  acao: string;
  tabela: string;
  registro_id: string;
  dados_anteriores?: string;
  dados_novos?: string;
  created_at: string;
}

// ============================================================
// CONSENTIMENTO (LGPD)
// ============================================================

export interface Consentimento {
  id: string;
  morador_id: string;
  tipo: string;
  aceito: boolean;
  versao_politica: string;
  data_aceite: string;
  dados_coletados: string;
}

// ============================================================
// CEP / VIACAO
// ============================================================

export interface EnderecoViaCep {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

// ============================================================
// FILTROS E PAGINAÇÃO
// ============================================================

export interface FiltroVisitas {
  data_inicio?: string;
  data_fim?: string;
  status?: StatusVisita;
  residencia_id?: string;
}

export interface PaginacaoParams {
  pagina: number;
  por_pagina: number;
}

export interface ResultadoPaginado<T> {
  dados: T[];
  total: number;
  pagina: number;
  por_pagina: number;
  total_paginas: number;
}

// ============================================================
// BUSCA
// ============================================================

export interface ResultadoBusca {
  moradores: Morador[];
  residencias: Residencia[];
}
