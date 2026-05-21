import type {
  DashboardStats,
  VisitaPorPeriodo,
  VisitaPorAgente,
  VisitaPorBairro,
  FamiliaEmAtraso,
  VisitaComDetalhes,
  Agente,
  AgenteComEstatisticas,
  PaginatedResult,
  NivelCriticidade,
} from '@/types';
import { StatusVisita } from '@/types';

export const DEMO_STATS: DashboardStats = {
  visitas_hoje: 24,
  visitas_semana: 142,
  visitas_mes: 587,
  total_familias: 1243,
  total_moradores: 3891,
  agentes_ativos: 18,
  visitas_realizadas: 562,
  visitas_pendentes: 25,
  taxa_conclusao: 95.7,
};

export const DEMO_VISITAS_PERIODO: VisitaPorPeriodo[] = [
  { data: '2025-04-22', total_visitas: 18, realizadas: 16, canceladas: 1, nao_encontrado: 1 },
  { data: '2025-04-23', total_visitas: 22, realizadas: 20, canceladas: 1, nao_encontrado: 1 },
  { data: '2025-04-24', total_visitas: 25, realizadas: 23, canceladas: 0, nao_encontrado: 2 },
  { data: '2025-04-25', total_visitas: 19, realizadas: 17, canceladas: 2, nao_encontrado: 0 },
  { data: '2025-04-28', total_visitas: 28, realizadas: 26, canceladas: 1, nao_encontrado: 1 },
  { data: '2025-04-29', total_visitas: 31, realizadas: 29, canceladas: 1, nao_encontrado: 1 },
  { data: '2025-04-30', total_visitas: 27, realizadas: 25, canceladas: 0, nao_encontrado: 2 },
  { data: '2025-05-01', total_visitas: 22, realizadas: 21, canceladas: 1, nao_encontrado: 0 },
  { data: '2025-05-02', total_visitas: 24, realizadas: 22, canceladas: 0, nao_encontrado: 2 },
  { data: '2025-05-05', total_visitas: 30, realizadas: 28, canceladas: 1, nao_encontrado: 1 },
  { data: '2025-05-06', total_visitas: 26, realizadas: 24, canceladas: 2, nao_encontrado: 0 },
  { data: '2025-05-07', total_visitas: 29, realizadas: 27, canceladas: 0, nao_encontrado: 2 },
  { data: '2025-05-08', total_visitas: 33, realizadas: 31, canceladas: 1, nao_encontrado: 1 },
  { data: '2025-05-09', total_visitas: 35, realizadas: 33, canceladas: 1, nao_encontrado: 1 },
  { data: '2025-05-12', total_visitas: 21, realizadas: 20, canceladas: 0, nao_encontrado: 1 },
  { data: '2025-05-13', total_visitas: 28, realizadas: 26, canceladas: 1, nao_encontrado: 1 },
  { data: '2025-05-14', total_visitas: 32, realizadas: 30, canceladas: 1, nao_encontrado: 1 },
  { data: '2025-05-15', total_visitas: 29, realizadas: 27, canceladas: 2, nao_encontrado: 0 },
  { data: '2025-05-16', total_visitas: 24, realizadas: 23, canceladas: 0, nao_encontrado: 1 },
  { data: '2025-05-19', total_visitas: 36, realizadas: 34, canceladas: 1, nao_encontrado: 1 },
  { data: '2025-05-20', total_visitas: 38, realizadas: 36, canceladas: 1, nao_encontrado: 1 },
  { data: '2025-05-21', total_visitas: 24, realizadas: 22, canceladas: 0, nao_encontrado: 2 },
];

export const DEMO_VISITAS_AGENTE: VisitaPorAgente[] = [
  { agente_id: 'a1', nome: 'Ana Beatriz Souza', total: 87, realizadas: 83, pendentes: 4, taxa: 95.4 },
  { agente_id: 'a2', nome: 'Carlos Eduardo Lima', total: 74, realizadas: 70, pendentes: 4, taxa: 94.6 },
  { agente_id: 'a3', nome: 'Fernanda Costa', total: 92, realizadas: 89, pendentes: 3, taxa: 96.7 },
  { agente_id: 'a4', nome: 'João Paulo Mendes', total: 68, realizadas: 64, pendentes: 4, taxa: 94.1 },
  { agente_id: 'a5', nome: 'Patrícia Oliveira', total: 81, realizadas: 76, pendentes: 5, taxa: 93.8 },
  { agente_id: 'a6', nome: 'Roberto Ferreira', total: 79, realizadas: 75, pendentes: 4, taxa: 94.9 },
  { agente_id: 'a7', nome: 'Sandra Campos', total: 65, realizadas: 63, pendentes: 2, taxa: 96.9 },
  { agente_id: 'a8', nome: 'Marcos Rocha', total: 71, realizadas: 67, pendentes: 4, taxa: 94.4 },
];

export const DEMO_VISITAS_BAIRRO: VisitaPorBairro[] = [
  { bairro: 'Centro', total_visitas: 142, total_familias: 280, cobertura_pct: 92.3 },
  { bairro: 'Vila Nova', total_visitas: 98, total_familias: 210, cobertura_pct: 87.6 },
  { bairro: 'Jardim das Flores', total_visitas: 87, total_familias: 190, cobertura_pct: 89.5 },
  { bairro: 'Bom Retiro', total_visitas: 76, total_familias: 175, cobertura_pct: 84.3 },
  { bairro: 'São José', total_visitas: 65, total_familias: 155, cobertura_pct: 80.7 },
  { bairro: 'Santa Maria', total_visitas: 58, total_familias: 120, cobertura_pct: 88.2 },
  { bairro: 'Parque Industrial', total_visitas: 42, total_familias: 105, cobertura_pct: 75.1 },
  { bairro: 'Jardim América', total_visitas: 19, total_familias: 8, cobertura_pct: 67.4 },
];

export const DEMO_ALERTAS: FamiliaEmAtraso[] = [
  { residencia_id: 'r1', endereco: 'Rua das Palmeiras, 123', bairro: 'Centro', microarea: '001', agente_nome: 'Ana Beatriz Souza', agente_id: 'a1', ultima_visita: '2025-03-01', dias_sem_visita: 81, nivel_criticidade: 'critico' as NivelCriticidade },
  { residencia_id: 'r2', endereco: 'Av. Brasil, 450', bairro: 'Vila Nova', microarea: '003', agente_nome: 'Carlos Eduardo Lima', agente_id: 'a2', ultima_visita: '2025-03-15', dias_sem_visita: 67, nivel_criticidade: 'alerta' as NivelCriticidade },
  { residencia_id: 'r3', endereco: 'Rua Flores, 78', bairro: 'Jardim das Flores', microarea: '005', agente_nome: 'Fernanda Costa', agente_id: 'a3', ultima_visita: '2025-03-22', dias_sem_visita: 60, nivel_criticidade: 'alerta' as NivelCriticidade },
  { residencia_id: 'r4', endereco: 'Rua das Acácias, 201', bairro: 'Bom Retiro', microarea: '007', agente_nome: 'João Paulo Mendes', agente_id: 'a4', ultima_visita: '2025-04-01', dias_sem_visita: 50, nivel_criticidade: 'atencao' as NivelCriticidade },
  { residencia_id: 'r5', endereco: 'Rua São Pedro, 55', bairro: 'São José', microarea: '002', agente_nome: 'Patrícia Oliveira', agente_id: 'a5', ultima_visita: '2025-04-10', dias_sem_visita: 41, nivel_criticidade: 'atencao' as NivelCriticidade },
];

export const DEMO_VISITAS_RECENTES: VisitaComDetalhes[] = [
  {
    id: 'v1', agente_id: 'a1', residencia_id: 'r10', morador_id: 'm1',
    data_visita: '2025-05-21T09:30:00', status: StatusVisita.REALIZADA,
    observacoes: 'Consulta de rotina. Família em boas condições.', precisa_agendamento: false,
    created_at: '2025-05-21T09:30:00', updated_at: '2025-05-21T09:30:00',
    agente: { id: 'a1', nome: 'Ana Beatriz Souza', area_atuacao: 'Centro - Microárea 001' },
    residencia: { id: 'r10', logradouro: 'Rua das Palmeiras', numero: '245', bairro: 'Centro', cidade: 'São Paulo' },
    morador: { id: 'm1', nome: 'Maria Aparecida da Silva', cpf: '***.***.***-01' },
  },
  {
    id: 'v2', agente_id: 'a2', residencia_id: 'r11', morador_id: 'm2',
    data_visita: '2025-05-21T10:00:00', status: StatusVisita.REALIZADA,
    observacoes: 'Paciente hipertenso. Medicação em dia.', precisa_agendamento: false,
    created_at: '2025-05-21T10:00:00', updated_at: '2025-05-21T10:00:00',
    agente: { id: 'a2', nome: 'Carlos Eduardo Lima', area_atuacao: 'Vila Nova - Microárea 003' },
    residencia: { id: 'r11', logradouro: 'Av. Brasil', numero: '120', bairro: 'Vila Nova', cidade: 'São Paulo' },
    morador: { id: 'm2', nome: 'José Roberto Santos', cpf: '***.***.***-02' },
  },
  {
    id: 'v3', agente_id: 'a3', residencia_id: 'r12', morador_id: 'm3',
    data_visita: '2025-05-21T10:45:00', status: StatusVisita.NAO_ENCONTRADO,
    observacoes: 'Morador não estava em casa no momento da visita.', precisa_agendamento: false,
    created_at: '2025-05-21T10:45:00', updated_at: '2025-05-21T10:45:00',
    agente: { id: 'a3', nome: 'Fernanda Costa', area_atuacao: 'Jardim das Flores - Microárea 005' },
    residencia: { id: 'r12', logradouro: 'Rua das Flores', numero: '78', bairro: 'Jardim das Flores', cidade: 'São Paulo' },
    morador: { id: 'm3', nome: 'Ana Lima Ferreira', cpf: '***.***.***-03' },
  },
  {
    id: 'v4', agente_id: 'a4', residencia_id: 'r13', morador_id: 'm4',
    data_visita: '2025-05-21T11:20:00', status: StatusVisita.REALIZADA,
    queixas: 'Dor de cabeça frequente', precisa_agendamento: true, especialidade_agendamento: 'Neurologista',
    created_at: '2025-05-21T11:20:00', updated_at: '2025-05-21T11:20:00',
    agente: { id: 'a4', nome: 'João Paulo Mendes', area_atuacao: 'Bom Retiro - Microárea 007' },
    residencia: { id: 'r13', logradouro: 'Rua das Acácias', numero: '33', bairro: 'Bom Retiro', cidade: 'São Paulo' },
    morador: { id: 'm4', nome: 'Pedro Henrique Costa', cpf: '***.***.***-04' },
  },
  {
    id: 'v5', agente_id: 'a5', residencia_id: 'r14', morador_id: 'm5',
    data_visita: '2025-05-21T14:00:00', status: StatusVisita.AGENDADA,
    observacoes: 'Visita programada para o período da tarde.', precisa_agendamento: false,
    created_at: '2025-05-21T14:00:00', updated_at: '2025-05-21T14:00:00',
    agente: { id: 'a5', nome: 'Patrícia Oliveira', area_atuacao: 'São José - Microárea 002' },
    residencia: { id: 'r14', logradouro: 'Rua São Pedro', numero: '55', bairro: 'São José', cidade: 'São Paulo' },
    morador: { id: 'm5', nome: 'Luciana Campos', cpf: '***.***.***-05' },
  },
];

export const DEMO_VISITAS_PAGINADO: PaginatedResult<VisitaComDetalhes> = {
  data: [
    ...DEMO_VISITAS_RECENTES,
    {
      id: 'v6', agente_id: 'a6', residencia_id: 'r15', morador_id: 'm6',
      data_visita: '2025-05-20T09:00:00', status: StatusVisita.REALIZADA,
      observacoes: 'Paciente diabético. Orientações nutricionais realizadas.', precisa_agendamento: false,
      created_at: '2025-05-20T09:00:00', updated_at: '2025-05-20T09:00:00',
      agente: { id: 'a6', nome: 'Roberto Ferreira', area_atuacao: 'Santa Maria - Microárea 004' },
      residencia: { id: 'r15', logradouro: 'Rua Santa Luzia', numero: '88', bairro: 'Santa Maria', cidade: 'São Paulo' },
      morador: { id: 'm6', nome: 'Antônio Rodrigues', cpf: '***.***.***-06' },
    },
    {
      id: 'v7', agente_id: 'a7', residencia_id: 'r16',
      data_visita: '2025-05-20T10:30:00', status: StatusVisita.CANCELADA,
      observacoes: 'Visita cancelada por solicitação do morador.', precisa_agendamento: false,
      created_at: '2025-05-20T10:30:00', updated_at: '2025-05-20T10:30:00',
      agente: { id: 'a7', nome: 'Sandra Campos', area_atuacao: 'Parque Industrial - Microárea 006' },
      residencia: { id: 'r16', logradouro: 'Rua Industrial', numero: '500', bairro: 'Parque Industrial', cidade: 'São Paulo' },
    },
    {
      id: 'v8', agente_id: 'a8', residencia_id: 'r17', morador_id: 'm7',
      data_visita: '2025-05-20T11:45:00', status: StatusVisita.REALIZADA,
      observacoes: 'Gestante no 7º mês. Acompanhamento pré-natal em dia.', precisa_agendamento: false,
      created_at: '2025-05-20T11:45:00', updated_at: '2025-05-20T11:45:00',
      agente: { id: 'a8', nome: 'Marcos Rocha', area_atuacao: 'Jardim América - Microárea 008' },
      residencia: { id: 'r17', logradouro: 'Av. das Américas', numero: '320', bairro: 'Jardim América', cidade: 'São Paulo' },
      morador: { id: 'm7', nome: 'Camila Pereira', cpf: '***.***.***-07' },
    },
  ],
  total: 587,
  page: 1,
  per_page: 20,
  total_pages: 30,
};

export const DEMO_AGENTES: Agente[] = [
  { id: 'a1', nome: 'Ana Beatriz Souza', cpf: '111.222.333-01', email: 'ana.souza@conectagente.local', telefone: '(11) 98001-1111', area_atuacao: 'Centro - Microárea 001', unidade_saude: 'UBS Central', microarea: '001', ativo: true, role: 'agente', created_at: '2024-01-10T00:00:00', updated_at: '2025-05-21T00:00:00' },
  { id: 'a2', nome: 'Carlos Eduardo Lima', cpf: '111.222.333-02', email: 'carlos.lima@conectagente.local', telefone: '(11) 98002-2222', area_atuacao: 'Vila Nova - Microárea 003', unidade_saude: 'UBS Central', microarea: '003', ativo: true, role: 'agente', created_at: '2024-02-01T00:00:00', updated_at: '2025-05-21T00:00:00' },
  { id: 'a3', nome: 'Fernanda Costa', cpf: '111.222.333-03', email: 'fernanda.costa@conectagente.local', telefone: '(11) 98003-3333', area_atuacao: 'Jardim das Flores - Microárea 005', unidade_saude: 'UBS Norte', microarea: '005', ativo: true, role: 'agente', created_at: '2024-01-15T00:00:00', updated_at: '2025-05-21T00:00:00' },
  { id: 'a4', nome: 'João Paulo Mendes', cpf: '111.222.333-04', email: 'joao.mendes@conectagente.local', telefone: '(11) 98004-4444', area_atuacao: 'Bom Retiro - Microárea 007', unidade_saude: 'UBS Norte', microarea: '007', ativo: true, role: 'agente', created_at: '2024-03-01T00:00:00', updated_at: '2025-05-21T00:00:00' },
  { id: 'a5', nome: 'Patrícia Oliveira', cpf: '111.222.333-05', email: 'patricia.oliveira@conectagente.local', telefone: '(11) 98005-5555', area_atuacao: 'São José - Microárea 002', unidade_saude: 'UBS Central', microarea: '002', ativo: true, role: 'agente', created_at: '2024-02-15T00:00:00', updated_at: '2025-05-21T00:00:00' },
  { id: 'a6', nome: 'Roberto Ferreira', cpf: '111.222.333-06', email: 'roberto.ferreira@conectagente.local', telefone: '(11) 98006-6666', area_atuacao: 'Santa Maria - Microárea 004', unidade_saude: 'UBS Sul', microarea: '004', ativo: true, role: 'agente', created_at: '2024-01-20T00:00:00', updated_at: '2025-05-21T00:00:00' },
  { id: 'a7', nome: 'Sandra Campos', cpf: '111.222.333-07', email: 'sandra.campos@conectagente.local', telefone: '(11) 98007-7777', area_atuacao: 'Parque Industrial - Microárea 006', unidade_saude: 'UBS Sul', microarea: '006', ativo: true, role: 'agente', created_at: '2024-03-10T00:00:00', updated_at: '2025-05-21T00:00:00' },
  { id: 'a8', nome: 'Marcos Rocha', cpf: '111.222.333-08', email: 'marcos.rocha@conectagente.local', telefone: '(11) 98008-8888', area_atuacao: 'Jardim América - Microárea 008', unidade_saude: 'UBS Leste', microarea: '008', ativo: true, role: 'agente', created_at: '2024-04-01T00:00:00', updated_at: '2025-05-21T00:00:00' },
];

export const DEMO_AGENTES_COM_STATS: AgenteComEstatisticas[] = DEMO_AGENTES.map((a, i) => ({
  ...a,
  total_visitas: DEMO_VISITAS_AGENTE[i]?.total ?? 70,
  visitas_realizadas: DEMO_VISITAS_AGENTE[i]?.realizadas ?? 66,
  visitas_mes: Math.round((DEMO_VISITAS_AGENTE[i]?.total ?? 70) / 4),
  total_familias: Math.round(1243 / DEMO_AGENTES.length),
  total_moradores: Math.round(3891 / DEMO_AGENTES.length),
  taxa_conclusao: DEMO_VISITAS_AGENTE[i]?.taxa ?? 94.5,
}));

export const DEMO_AGENTES_PAGINADO: PaginatedResult<AgenteComEstatisticas> = {
  data: DEMO_AGENTES_COM_STATS,
  total: DEMO_AGENTES.length,
  page: 1,
  per_page: 20,
  total_pages: 1,
};

/** Retorna true quando o resultado do Supabase é todo vazio/zero */
export function isEmptyStats(stats: DashboardStats): boolean {
  return stats.total_familias === 0 && stats.agentes_ativos === 0 && stats.visitas_mes === 0;
}

export function isEmptyList<T>(list: T[]): boolean {
  return !list || list.length === 0;
}
