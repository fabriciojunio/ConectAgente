// ===========================================================================
// ConectAgente Web Dashboard - TypeScript Type Definitions
// ===========================================================================
// Types mirror the Supabase database schema and provide web-specific types
// for the dashboard application.
// ===========================================================================

// ---------------------------------------------------------------------------
// Role Types
// ---------------------------------------------------------------------------

/** User roles within the ConectAgente system */
export type UserRole = 'agente' | 'supervisor' | 'admin';

// ---------------------------------------------------------------------------
// Enums (matching the React Native app)
// ---------------------------------------------------------------------------

/** Status de uma visita domiciliar */
export enum StatusVisita {
  AGENDADA = 'agendada',
  REALIZADA = 'realizada',
  CANCELADA = 'cancelada',
  NAO_ENCONTRADO = 'nao_encontrado',
}

/** Sexo biologico do morador */
export enum Sexo {
  MASCULINO = 'masculino',
  FEMININO = 'feminino',
  OUTRO = 'outro',
}

/** Tipo de imovel da residencia */
export enum TipoImovel {
  PROPRIO = 'proprio',
  ALUGADO = 'alugado',
  CEDIDO = 'cedido',
  OUTROS = 'outros',
}

/** Nivel de vulnerabilidade de uma familia */
export enum NivelVulnerabilidade {
  BAIXO = 'baixo',
  MEDIO = 'medio',
  ALTO = 'alto',
  CRITICO = 'critico',
}

/** Nivel de criticidade baseado em dias sem visita */
export enum NivelCriticidade {
  NORMAL = 'normal',
  ATENCAO = 'atencao',
  ALERTA = 'alerta',
  CRITICO = 'critico',
}

// ---------------------------------------------------------------------------
// Database Row Types (matching Supabase schema exactly)
// ---------------------------------------------------------------------------

/** Agente Comunitario de Saude */
export interface Agente {
  id: string;
  nome: string;
  cpf: string;
  email: string;
  telefone?: string;
  area_atuacao: string;
  unidade_saude: string;
  microarea?: string;
  ativo: boolean;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

/** Residencia cadastrada no sistema */
export interface Residencia {
  id: string;
  agente_id: string;
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
  sync_status: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

/** Morador de uma residencia */
export interface Morador {
  id: string;
  residencia_id: string;
  agente_id: string;
  nome: string;
  cpf?: string;
  cartao_sus?: string;
  telefone?: string;
  data_nascimento: string;
  sexo: Sexo;
  escolaridade?: string;
  profissao?: string;
  tem_doenca: boolean;
  doencas?: string;
  is_responsavel: boolean;
  is_hipertenso: boolean;
  is_diabetico: boolean;
  is_gestante: boolean;
  is_domiciliado: boolean;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

/** Visita domiciliar registrada */
export interface Visita {
  id: string;
  agente_id: string;
  residencia_id: string;
  morador_id?: string;
  data_visita: string;
  status: StatusVisita;
  queixas?: string;
  observacoes?: string;
  precisa_agendamento: boolean;
  especialidade_agendamento?: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Dashboard / Aggregation Types
// ---------------------------------------------------------------------------

/** Estatisticas gerais do dashboard */
export interface DashboardStats {
  visitas_hoje: number;
  visitas_semana: number;
  visitas_mes: number;
  total_familias: number;
  total_moradores: number;
  agentes_ativos: number;
  visitas_realizadas: number;
  visitas_pendentes: number;
  taxa_conclusao: number;
}

/** Visitas agrupadas por periodo (dia) */
export interface VisitaPorPeriodo {
  data: string;
  total_visitas: number;
  realizadas: number;
  canceladas: number;
  nao_encontrado: number;
}

/** Visitas agrupadas por agente */
export interface VisitaPorAgente {
  agente_id: string;
  nome: string;
  total: number;
  realizadas: number;
  pendentes: number;
  taxa: number;
}

/** Visitas agrupadas por bairro */
export interface VisitaPorBairro {
  bairro: string;
  total_visitas: number;
  total_familias: number;
  cobertura_pct: number;
}

/** Familia em atraso de visita */
export interface FamiliaEmAtraso {
  residencia_id: string;
  endereco: string;
  bairro: string;
  microarea?: string;
  agente_nome: string;
  agente_id: string;
  ultima_visita: string;
  dias_sem_visita: number;
  nivel_criticidade: NivelCriticidade;
}

/** Cobertura por microarea */
export interface CoberturaMicroarea {
  microarea: string;
  total_familias: number;
  familias_visitadas_30d: number;
  cobertura_pct: number;
}

// ---------------------------------------------------------------------------
// Filter Types
// ---------------------------------------------------------------------------

/** Filtros globais aplicaveis a todas as consultas */
export interface GlobalFilters {
  periodo_inicio?: string;
  periodo_fim?: string;
  unidade_saude?: string;
  bairro?: string;
  microarea?: string;
  agente_id?: string;
  status?: StatusVisita;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/** Parametros de paginacao */
export interface PaginationParams {
  page: number;
  per_page: number;
}

/** Resultado paginado generico */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** Usuario autenticado com informacoes de perfil */
export interface AuthUser {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  unidade_saude: string;
  area_atuacao: string;
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

/** Registro de auditoria para conformidade LGPD */
export interface AuditLog {
  id: string;
  agente_id: string;
  acao: string;
  tabela: string;
  registro_id: string;
  dados_anteriores?: Record<string, unknown>;
  dados_novos?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Report Types
// ---------------------------------------------------------------------------

/** Filtros para geracao de relatorios */
export interface RelatorioFiltros {
  tipo: 'visitas' | 'agentes' | 'familias' | 'cobertura' | 'atrasos';
  periodo_inicio: string;
  periodo_fim: string;
  unidade_saude?: string;
  agente_id?: string;
  bairro?: string;
  formato: 'pdf' | 'excel' | 'csv';
}

// ---------------------------------------------------------------------------
// Joined / Display Types
// ---------------------------------------------------------------------------

/** Visita com detalhes de agente, residencia e morador */
export interface VisitaComDetalhes extends Visita {
  agente?: Pick<Agente, 'id' | 'nome' | 'area_atuacao'>;
  residencia?: Pick<Residencia, 'id' | 'logradouro' | 'numero' | 'bairro' | 'cidade'>;
  morador?: Pick<Morador, 'id' | 'nome' | 'cpf'>;
}

/** Residencia com detalhes de agente, moradores e ultima visita */
export interface ResidenciaComDetalhes extends Residencia {
  agente?: Pick<Agente, 'id' | 'nome'>;
  moradores?: Morador[];
  ultima_visita?: string;
  dias_sem_visita?: number;
}

/** Agente com estatisticas de desempenho */
export interface AgenteComEstatisticas extends Agente {
  total_visitas: number;
  visitas_realizadas: number;
  visitas_mes: number;
  total_familias: number;
  total_moradores: number;
  taxa_conclusao: number;
}

// ---------------------------------------------------------------------------
// Registration Request
// ---------------------------------------------------------------------------

/** Status de uma solicitação de registro */
export type StatusRegistro = 'pendente' | 'aprovado' | 'rejeitado';

/** Cargos disponíveis para auto-registro (admin não pode ser solicitado) */
export type CargoRegistro = 'supervisor' | 'outro';

/** Solicitação de registro de novo usuário */
export interface SolicitacaoRegistro {
  id: string;
  nome: string;
  cpf: string;
  telefone?: string;
  cargo_pretendido: CargoRegistro;
  cargo_outro?: string;
  unidade_saude: string;
  area_atuacao: string;
  justificativa: string;
  status: StatusRegistro;
  motivo_rejeicao?: string;
  aprovado_por?: string;
  aprovado_em?: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Sidebar (used by layout components)
// ---------------------------------------------------------------------------

/** Item de navegacao lateral */
export interface SidebarItem {
  label: string;
  href: string;
  icon: string;
  roles: UserRole[];
}
