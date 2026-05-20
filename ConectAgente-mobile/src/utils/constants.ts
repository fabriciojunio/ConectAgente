// ============================================================
// CORES DO DESIGN SYSTEM
// ============================================================

export const COLORS = {
  // Paleta principal — azul saúde pública
  primary: '#1565C0',
  primaryDark: '#0D47A1',
  primaryLight: '#42A5F5',
  primaryGradient: ['#0D47A1', '#1976D2', '#42A5F5'] as const,

  // Secundária
  secondary: '#00897B',
  secondaryLight: '#E0F2F1',

  // Superfícies
  background: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2FB',
  white: '#FFFFFF',
  black: '#000000',

  // Texto
  text: '#0F1621',
  textMedium: '#374151',
  textLight: '#6B7280',
  placeholder: '#9CA3AF',

  // Bordas
  border: '#D1D9E6',
  borderLight: '#E5EAF2',

  // Feedback
  error: '#D32F2F',
  errorLight: '#FFEBEE',
  success: '#2E7D32',
  successLight: '#E8F5E9',
  warning: '#E65100',
  warningLight: '#FFF3E0',
  info: '#0277BD',
  infoLight: '#E1F5FE',

  // Card
  card: '#FFFFFF',
  cardShadow: 'rgba(21, 101, 192, 0.08)',

  // Misc
  disabled: '#CBD5E1',
  overlay: 'rgba(13, 71, 161, 0.45)',
  divider: '#E8EDF5',

  // Badges por condição clínica
  hipertenso: '#C62828',
  diabetico: '#6A1B9A',
  gestante: '#AD1457',
  puericultura: '#00695C',
  domiciliado: '#1565C0',
} as const;

// ============================================================
// ESPAÇAMENTOS
// ============================================================

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// ============================================================
// TIPOGRAFIA
// ============================================================

export const FONT_SIZE = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// ============================================================
// STORAGE KEYS (expo-secure-store)
// ============================================================

export const SECURE_KEYS = {
  AUTH_TOKEN: 'conectagente_auth_token',
  REFRESH_TOKEN: 'conectagente_refresh_token',
  AGENTE_ID: 'conectagente_agente_id',
  SESSION_EXPIRES: 'conectagente_session_expires',
  ENCRYPTION_KEY: 'conectagente_enc_key',
} as const;

// ============================================================
// BANCO DE DADOS
// ============================================================

export const DB_NAME = 'conectagente.db';
export const DB_VERSION = 1;

// ============================================================
// API
// ============================================================

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.conectagente.com.br/v1';
export const API_TIMEOUT = 15000;

// ============================================================
// SYNC
// ============================================================

export const SYNC_INTERVAL_MS = 30000; // 30 segundos
export const SYNC_MAX_TENTATIVAS = 5;
export const SYNC_BATCH_SIZE = 50;

// ============================================================
// SESSÃO (LGPD / Segurança)
// ============================================================

export const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 horas
export const SESSION_WARNING_MS = 5 * 60 * 1000; // 5 min antes de expirar

// ============================================================
// LGPD
// ============================================================

export const LGPD = {
  VERSAO_POLITICA: '1.0.0',
  TIPOS_CONSENTIMENTO: {
    DADOS_PESSOAIS: 'dados_pessoais',
    DADOS_SAUDE: 'dados_saude',
    COMPARTILHAMENTO_GOVERNO: 'compartilhamento_governo',
  },
} as const;

// ============================================================
// VALIDAÇÕES
// ============================================================

export const VALIDATION = {
  CPF_LENGTH: 11,
  CARTAO_SUS_LENGTH: 15,
  CEP_LENGTH: 8,
  SENHA_MIN_LENGTH: 8,
  NOME_MIN_LENGTH: 3,
} as const;

// ============================================================
// PAGINAÇÃO
// ============================================================

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// ============================================================
// OPÇÕES DE SELECT
// ============================================================

export const ESCOLARIDADE_OPTIONS = [
  { label: 'Sem escolaridade', value: 'sem_escolaridade' },
  { label: 'Fundamental Incompleto', value: 'fundamental_incompleto' },
  { label: 'Fundamental Completo', value: 'fundamental_completo' },
  { label: 'Médio Incompleto', value: 'medio_incompleto' },
  { label: 'Médio Completo', value: 'medio_completo' },
  { label: 'Superior Incompleto', value: 'superior_incompleto' },
  { label: 'Superior Completo', value: 'superior_completo' },
  { label: 'Pós-Graduação', value: 'pos_graduacao' },
];

export const TIPO_IMOVEL_OPTIONS = [
  { label: 'Própria', value: 'proprio' },
  { label: 'Alugada', value: 'alugado' },
  { label: 'Cedida', value: 'cedido' },
  { label: 'Outros', value: 'outros' },
];

export const SEXO_OPTIONS = [
  { label: 'Masculino', value: 'masculino' },
  { label: 'Feminino', value: 'feminino' },
  { label: 'Outro', value: 'outro' },
];

export const ESPECIALIDADES = [
  'Cardiologia',
  'Dermatologia',
  'Endocrinologia',
  'Ginecologia',
  'Neurologia',
  'Oftalmologia',
  'Ortopedia',
  'Pediatria',
  'Psicologia',
  'Psiquiatria',
  'Reumatologia',
  'Urologia',
  'Outras',
];

export const ESTADOS_BRASIL = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];
