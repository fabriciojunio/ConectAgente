'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePagination } from '@/hooks/usePagination';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { getUsuarios, atualizarRole, toggleAtivoUsuario } from '@/services/adminService';
import { cacheGetStale } from '@/lib/cache';
import { formatCPF, withTimeout } from '@/lib/utils';
import type { PaginatedResult, Agente } from '@/types';
import type { UserRole } from '@/types';
import {
  Search,
  Users,
  Shield,
  X,
  AlertTriangle,
} from 'lucide-react';

function SkeletonRows() {
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b last:border-0 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-4 bg-gray-200 rounded w-1/5" />
          <div className="h-4 bg-gray-200 rounded w-1/6" />
          <div className="h-4 bg-gray-200 rounded w-1/6" />
        </div>
      ))}
    </div>
  );
}

interface Usuario {
  id: string;
  nome: string;
  cpf: string;
  email?: string;
  unidade_saude?: string;
  role: UserRole;
  ativo: boolean;
}

const roleBadgeConfig: Record<string, { label: string; className: string }> = {
  admin: { label: 'Admin', className: 'bg-purple-100 text-purple-700' },
  supervisor: { label: 'Supervisor', className: 'bg-blue-100 text-blue-700' },
  agente: { label: 'Agente', className: 'bg-gray-100 text-gray-700' },
};

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: 'admin', label: 'Administrador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'agente', label: 'Agente' },
];

export default function UsuariosPage() {
  const { user } = useAuth();
  const { page, perPage, setPage, setTotalPages, totalPages } = usePagination();

  const initUsuarios = cacheGetStale<PaginatedResult<Agente>>(`usuarios_${page}_${perPage}`);

  const [loading, setLoading] = useState(!initUsuarios);
  const [error, setError] = useState('');
  const [usuarios, setUsuarios] = useState<Usuario[]>((initUsuarios?.data as unknown as Usuario[]) ?? []);
  const [search, setSearch] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'role' | 'status';
    usuario: Usuario;
    newRole?: UserRole;
  } | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchData = useCallback(async () => {
    if (usuarios.length === 0) setLoading(true);
    setError('');
    try {
      const result = await withTimeout(getUsuarios({ page, per_page: perPage }), { data: [], total: 0, page, per_page: perPage, total_pages: 0 });
      setUsuarios(result.data);
      setTotalPages(result.total_pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Role guard
  if (user && user.role !== 'admin') {
    return (
      <div className="page-container">
        <EmptyState
          title="Acesso restrito"
          description="Apenas administradores podem gerenciar usuários."
        />
      </div>
    );
  }

  const filteredUsuarios = search
    ? usuarios.filter(
        (u) =>
          u.nome?.toLowerCase().includes(search.toLowerCase()) ||
          u.cpf?.includes(search.replace(/\D/g, ''))
      )
    : usuarios;

  async function handleRoleChange(usuario: Usuario, newRole: UserRole) {
    setConfirmDialog({ type: 'role', usuario, newRole });
  }

  async function handleToggleAtivo(usuario: Usuario) {
    setConfirmDialog({ type: 'status', usuario });
  }

  async function handleConfirm() {
    if (!confirmDialog) return;
    setUpdating(true);
    try {
      if (confirmDialog.type === 'role' && confirmDialog.newRole) {
        await atualizarRole(confirmDialog.usuario.id, confirmDialog.newRole!);
      } else if (confirmDialog.type === 'status') {
        await toggleAtivoUsuario(confirmDialog.usuario.id, !confirmDialog.usuario.ativo);
      }
      setConfirmDialog(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar usuário');
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="page-container">
      <div className="flex items-center gap-3">
        <Users className="w-7 h-7 text-primary-600" />
        <div>
          <h1 className="page-title">Gerenciar Usuários</h1>
          <p className="page-subtitle">Administração de contas e permissões de acesso</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome ou CPF..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
        />
      </div>

      {/* Table */}
      {loading && usuarios.length === 0 ? (
        <SkeletonRows />
      ) : filteredUsuarios.length === 0 ? (
        <EmptyState
          title="Nenhum usuário encontrado"
          description="Não foram encontrados usuários com os filtros selecionados."
        />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">CPF</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Unidade</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Perfil</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsuarios.map((usuario) => {
                  const badge = roleBadgeConfig[usuario.role] ?? roleBadgeConfig.agente;
                  return (
                    <tr key={usuario.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{usuario.nome}</td>
                      <td className="px-4 py-3 hidden md:table-cell">{formatCPF(usuario.cpf)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-500">
                        {usuario.email || '-'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">{usuario.unidade_saude ?? '-'}</td>
                      <td className="px-4 py-3">
                        <select
                          value={usuario.role}
                          onChange={(e) => handleRoleChange(usuario, e.target.value as UserRole)}
                          className="text-xs rounded-lg border border-gray-200 px-2 py-1 focus:border-primary-500 outline-none bg-white"
                        >
                          {roleOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            usuario.ativo
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {usuario.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleAtivo(usuario)}
                          className="text-xs"
                        >
                          {usuario.ativo ? 'Desativar' : 'Ativar'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <p className="text-sm text-gray-500">
                Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <h2 className="text-lg font-semibold">Confirmar Alteração</h2>
              </div>
              <button
                onClick={() => setConfirmDialog(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              {confirmDialog.type === 'role'
                ? `Deseja alterar o perfil de "${confirmDialog.usuario.nome}" para "${
                    roleOptions.find((r) => r.value === confirmDialog.newRole)?.label ?? ''
                  }"?`
                : `Deseja ${confirmDialog.usuario.ativo ? 'desativar' : 'ativar'} o usuário "${confirmDialog.usuario.nome}"?`}
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirmDialog(null)} disabled={updating}>
                Cancelar
              </Button>
              <Button onClick={handleConfirm} loading={updating}>
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
