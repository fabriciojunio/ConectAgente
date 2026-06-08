'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { EmptyState } from '@/components/ui/empty-state';
import { getEstatisticasSistema, getAuditLogs } from '@/services/adminService';
import { cacheGetStale } from '@/lib/cache';
import { formatDate, withTimeout } from '@/lib/utils';
import type { PaginatedResult } from '@/types';
import {
  Shield,
  Users,
  Home,
  ClipboardList,
  UserCheck,
  FileText,
  ChevronRight,
} from 'lucide-react';

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b last:border-0 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/5" />
        </div>
      ))}
    </>
  );
}

interface SystemStats {
  total_agentes: number;
  total_familias: number;
  total_visitas: number;
  total_moradores: number;
}

interface AuditLog {
  id: string;
  acao: string;
  tabela: string;
  agente_id: string;
  created_at: string;
}

export default function AdminPage() {
  const { user } = useAuth();

  const initStats = cacheGetStale<SystemStats>('estatisticas_sistema');
  const initLogs = cacheGetStale<PaginatedResult<AuditLog>>(`audit_logs_${JSON.stringify({})}_1_20`);

  const [loading, setLoading] = useState(!initStats);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<SystemStats | null>(initStats);
  const [logs, setLogs] = useState<AuditLog[]>((initLogs?.data as AuditLog[]) ?? []);

  useEffect(() => {
    if (!stats) setLoading(true);
    setError('');
    const done = { count: 0, total: 2 };
    const checkDone = () => { if (++done.count >= done.total) setLoading(false); };

    withTimeout(getAuditLogs(undefined, { page: 1, per_page: 20 }), { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 })
      .then((d) => setLogs(d.data as AuditLog[])).catch(() => {}).finally(checkDone);
    withTimeout(getEstatisticasSistema(), { total_agentes: 0, total_familias: 0, total_visitas: 0, total_moradores: 0, agentes_ativos: 0, ultimo_sync: '' })
      .then(setStats).catch((err) => { setError(err instanceof Error ? err.message : 'Erro ao carregar dados administrativos'); }).finally(checkDone);
  }, []);

  // Role guard
  if (user && user.role !== 'admin' && user.role !== 'supervisor') {
    return (
      <div className="page-container">
        <EmptyState
          title="Acesso restrito"
          description="Você não tem permissão para acessar esta página."
        />
      </div>
    );
  }

  const statCards = stats
    ? [
        { label: 'Total de Agentes', value: stats.total_agentes, icon: UserCheck, color: 'text-primary-600 bg-primary-50' },
        { label: 'Total de Famílias', value: stats.total_familias, icon: Home, color: 'text-green-600 bg-green-50' },
        { label: 'Total de Visitas', value: stats.total_visitas, icon: ClipboardList, color: 'text-blue-600 bg-blue-50' },
        { label: 'Total de Moradores', value: stats.total_moradores, icon: Users, color: 'text-purple-600 bg-purple-50' },
      ]
    : [];

  const quickLinks = [
    {
      label: 'Gerenciar Usuários',
      description: 'Administrar contas e permissões',
      href: '/admin/usuarios',
      icon: Users,
      color: 'text-primary-600 bg-primary-50',
    },
    {
      label: 'Logs de Auditoria',
      description: 'Histórico de ações do sistema',
      href: '#logs',
      icon: FileText,
      color: 'text-gray-600 bg-gray-100',
    },
  ];

  return (
    <div className="page-container">
      <div className="flex items-center gap-3">
        <Shield className="w-7 h-7 text-primary-600" />
        <div>
          <h1 className="page-title">Administração</h1>
          <p className="page-subtitle">Gerenciamento do sistema e usuários</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* System Stats */}
      {statCards.length > 0 && (
        <div className="card-grid">
          {statCards.map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-xl font-bold text-gray-900">{stat.value.toLocaleString('pt-BR')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Links */}
      <div>
        <h3 className="section-title">Acesso Rápido</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="bg-white rounded-xl border p-5 hover:shadow-md hover:border-primary-200 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${link.color}`}>
                    <link.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{link.label}</p>
                    <p className="text-sm text-gray-500">{link.description}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Audit Logs */}
      <div className="bg-white rounded-xl border p-6" id="logs">
        <h3 className="section-title flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-500" />
          Logs de Auditoria Recentes
        </h3>
        {loading && logs.length === 0 ? (
          <SkeletonRows />
        ) : logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Data/Hora</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Ação</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Tabela</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(log.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {log.acao}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500">
                      {log.tabela}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Nenhum log de auditoria encontrado.</p>
        )}
      </div>
    </div>
  );
}
