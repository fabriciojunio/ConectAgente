import type { UserRole, SidebarItem } from '@/types';
import { NivelCriticidade, StatusVisita } from '@/types';

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** All application route paths */
export const ROUTES = {
  DASHBOARD: '/',
  VISITAS: '/visitas',
  FAMILIAS: '/familias',
  MORADORES: '/moradores',
  AGENTES: '/agentes',
  MONITORAMENTO: '/monitoramento',
  TERRITORIAL: '/territorial',
  RELATORIOS: '/relatorios',
  ADMIN: '/admin',
  ADMIN_USUARIOS: '/admin/usuarios',
  ADMIN_SOLICITACOES: '/admin/solicitacoes',
  LOGIN: '/login',
  REGISTRO: '/registro',
} as const;

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/** Role metadata with permissions */
export const ROLES: Record<UserRole, {
  label: string;
  level: number;
  canViewAll: boolean;
  canManageUsers: boolean;
  canExport: boolean;
}> = {
  agente: {
    label: 'Agente',
    level: 1,
    canViewAll: false,
    canManageUsers: false,
    canExport: false,
  },
  supervisor: {
    label: 'Supervisor',
    level: 2,
    canViewAll: true,
    canManageUsers: false,
    canExport: true,
  },
  admin: {
    label: 'Administrador',
    level: 4,
    canViewAll: true,
    canManageUsers: true,
    canExport: true,
  },
};

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/** Pagination default values */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// ---------------------------------------------------------------------------
// Criticidade Ranges
// ---------------------------------------------------------------------------

/** Day ranges for each criticality level */
export const CRITICIDADE_RANGES = {
  [NivelCriticidade.NORMAL]: { min: 0, max: 7 },
  [NivelCriticidade.ATENCAO]: { min: 8, max: 15 },
  [NivelCriticidade.ALERTA]: { min: 16, max: 30 },
  [NivelCriticidade.CRITICO]: { min: 31, max: Infinity },
} as const;

// ---------------------------------------------------------------------------
// Status Labels
// ---------------------------------------------------------------------------

/** Portuguese labels for visit statuses */
export const STATUS_LABELS: Record<StatusVisita, string> = {
  [StatusVisita.AGENDADA]: 'Agendada',
  [StatusVisita.REALIZADA]: 'Realizada',
  [StatusVisita.CANCELADA]: 'Cancelada',
  [StatusVisita.NAO_ENCONTRADO]: 'Nao Encontrado',
};

// ---------------------------------------------------------------------------
// Chart Colors
// ---------------------------------------------------------------------------

/** Color palette for recharts graphs */
export const COLORS = [
  '#2563eb', // blue-600
  '#16a34a', // green-600
  '#dc2626', // red-600
  '#d97706', // amber-600
  '#7c3aed', // violet-600
  '#0891b2', // cyan-600
  '#c026d3', // fuchsia-600
  '#059669', // emerald-600
  '#e11d48', // rose-600
  '#4f46e5', // indigo-600
] as const;

// ---------------------------------------------------------------------------
// Sidebar Navigation
// ---------------------------------------------------------------------------

/** Sidebar navigation items with role-based access control */
export const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    label: 'Dashboard',
    href: ROUTES.DASHBOARD,
    icon: 'LayoutDashboard',
    roles: ['supervisor', 'admin'],
  },
  {
    label: 'Visitas',
    href: ROUTES.VISITAS,
    icon: 'ClipboardList',
    roles: ['supervisor', 'admin'],
  },
  {
    label: 'Famílias',
    href: ROUTES.FAMILIAS,
    icon: 'Users',
    roles: ['supervisor', 'admin'],
  },
  {
    label: 'Pacientes',
    href: ROUTES.MORADORES,
    icon: 'Heart',
    roles: ['supervisor', 'admin'],
  },
  {
    label: 'Agentes',
    href: ROUTES.AGENTES,
    icon: 'UserCheck',
    roles: ['supervisor', 'admin'],
  },
  {
    label: 'Monitoramento',
    href: ROUTES.MONITORAMENTO,
    icon: 'Activity',
    roles: ['supervisor', 'admin'],
  },
  {
    label: 'Territorial',
    href: ROUTES.TERRITORIAL,
    icon: 'Map',
    roles: ['supervisor', 'admin'],
  },
  {
    label: 'Relatórios',
    href: ROUTES.RELATORIOS,
    icon: 'FileBarChart',
    roles: ['supervisor', 'admin'],
  },
  {
    label: 'Administração',
    href: ROUTES.ADMIN,
    icon: 'Shield',
    roles: ['supervisor', 'admin'],
  },
  {
    label: 'Usuários',
    href: ROUTES.ADMIN_USUARIOS,
    icon: 'UserCog',
    roles: ['admin'],
  },
  {
    label: 'Solicitações',
    href: ROUTES.ADMIN_SOLICITACOES,
    icon: 'UserPlus',
    roles: ['admin'],
  },
];
