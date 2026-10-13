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
  // Os niveis seguem o alcance que as policies de RLS dao a cada papel:
  // agente ve os proprios pacientes, coordenador ve a propria unidade de
  // saude, gerente e admin veem tudo. Antes havia so 'supervisor', papel que
  // o CHECK de agentes.role nem aceita.
  coordenador: {
    label: 'Coordenador',
    level: 2,
    canViewAll: false,
    canManageUsers: false,
    canExport: true,
  },
  gerente: {
    label: 'Gerente',
    level: 3,
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

// ---------------------------------------------------------------------------
// Status Labels
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Chart Colors
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sidebar Navigation
// ---------------------------------------------------------------------------

/** Sidebar navigation items with role-based access control */
export const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    label: 'Dashboard',
    href: ROUTES.DASHBOARD,
    icon: 'LayoutDashboard',
    roles: ['agente', 'coordenador', 'gerente', 'admin'],
  },
  {
    label: 'Visitas',
    href: ROUTES.VISITAS,
    icon: 'ClipboardList',
    roles: ['agente', 'coordenador', 'gerente', 'admin'],
  },
  {
    label: 'Famílias',
    href: ROUTES.FAMILIAS,
    icon: 'Users',
    roles: ['agente', 'coordenador', 'gerente', 'admin'],
  },
  {
    label: 'Pacientes',
    href: ROUTES.MORADORES,
    icon: 'Heart',
    roles: ['agente', 'coordenador', 'gerente', 'admin'],
  },
  {
    label: 'Agentes',
    href: ROUTES.AGENTES,
    icon: 'UserCheck',
    roles: ['agente', 'coordenador', 'gerente', 'admin'],
  },
  {
    label: 'Monitoramento',
    href: ROUTES.MONITORAMENTO,
    icon: 'Activity',
    roles: ['agente', 'coordenador', 'gerente', 'admin'],
  },
  {
    label: 'Territorial',
    href: ROUTES.TERRITORIAL,
    icon: 'Map',
    roles: ['agente', 'coordenador', 'gerente', 'admin'],
  },
  {
    label: 'Relatórios',
    href: ROUTES.RELATORIOS,
    icon: 'FileBarChart',
    roles: ['agente', 'coordenador', 'gerente', 'admin'],
  },
  {
    label: 'Administração',
    href: ROUTES.ADMIN,
    icon: 'Shield',
    // Mesma regra da policy `audit_log_select`: gerente e admin.
    roles: ['gerente', 'admin'],
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
