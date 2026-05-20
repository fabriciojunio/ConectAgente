'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePagination } from '@/hooks/usePagination';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { getMoradores, getEstatisticasMoradores } from '@/services/moradorService';
import type { MoradorComDetalhes } from '@/services/moradorService';
import { cacheGetStale } from '@/lib/cache';
import { formatDate, withTimeout } from '@/lib/utils';
import type { PaginatedResult } from '@/types';
import {
  Search,
  Heart,
  Users,
  AlertTriangle,
  Baby,
  Stethoscope,
  Droplets,
  HomeIcon,
  X,
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

function formatCPF(cpf?: string): string {
  if (!cpf || cpf.length !== 11) return cpf || '-';
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

function calcularIdade(dataNascimento: string): number {
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mesAtual = hoje.getMonth();
  const mesNascimento = nascimento.getMonth();
  if (mesAtual < mesNascimento || (mesAtual === mesNascimento && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
}

const EMPTY_STATS = { total: 0, hipertensos: 0, diabeticos: 0, gestantes: 0, domiciliados: 0, com_doenca: 0 };

export default function MoradoresPage() {
  const { page, perPage, setPage, setTotalPages, totalPages } = usePagination();

  const initMoradores = cacheGetStale<PaginatedResult<MoradorComDetalhes>>(`moradores_{}_${page}_${perPage}`);
  const initStats = cacheGetStale<typeof EMPTY_STATS>('moradores_stats');

  const [loading, setLoading] = useState(!initMoradores);
  const [error, setError] = useState('');
  const [moradores, setMoradores] = useState<MoradorComDetalhes[]>(initMoradores?.data ?? []);
  const [search, setSearch] = useState('');
  const [selectedMorador, setSelectedMorador] = useState<MoradorComDetalhes | null>(null);
  const [estatisticas, setEstatisticas] = useState(initStats ?? EMPTY_STATS);

  const fetchData = useCallback(async () => {
    if (moradores.length === 0) setLoading(true);
    setError('');
    try {
      withTimeout(getEstatisticasMoradores(), EMPTY_STATS)
        .then(setEstatisticas).catch(() => {});

      const result = await withTimeout(
        getMoradores(undefined, { page, per_page: perPage }),
        { data: [], total: 0, page, per_page: perPage, total_pages: 0 }
      );
      setMoradores(result.data);
      setTotalPages(result.total_pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar moradores');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredMoradores = search
    ? moradores.filter(
        (m) =>
          m.nome?.toLowerCase().includes(search.toLowerCase()) ||
          m.cpf?.includes(search.replace(/\D/g, '')) ||
          m.cartao_sus?.includes(search.replace(/\D/g, '')) ||
          m.residencia?.bairro?.toLowerCase().includes(search.toLowerCase())
      )
    : moradores;

  const statCards = [
    { label: 'Total de Pacientes', value: estatisticas.total, icon: Users, color: 'text-primary-600 bg-primary-50' },
    { label: 'Hipertensos', value: estatisticas.hipertensos, icon: Heart, color: 'text-red-600 bg-red-50' },
    { label: 'Diabéticos', value: estatisticas.diabeticos, icon: Droplets, color: 'text-blue-600 bg-blue-50' },
    { label: 'Gestantes', value: estatisticas.gestantes, icon: Baby, color: 'text-pink-600 bg-pink-50' },
    { label: 'Com Doenças', value: estatisticas.com_doenca, icon: Stethoscope, color: 'text-orange-600 bg-orange-50' },
    { label: 'Domiciliados', value: estatisticas.domiciliados, icon: HomeIcon, color: 'text-purple-600 bg-purple-50' },
  ];

  return (
    <div className="page-container">
      <div>
        <h1 className="page-title">Pacientes / Moradores</h1>
        <p className="page-subtitle">Cadastro e acompanhamento dos moradores atendidos</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] text-gray-500 leading-tight">{stat.label}</p>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
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
          placeholder="Buscar por nome, CPF, SUS ou bairro..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
        />
      </div>

      {/* Table */}
      {loading && moradores.length === 0 ? (
        <SkeletonRows />
      ) : filteredMoradores.length === 0 ? (
        <EmptyState
          title="Nenhum morador encontrado"
          description="Não foram encontrados moradores com os filtros selecionados."
        />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">CPF</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Idade</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Bairro</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Agente</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Condições</th>
                </tr>
              </thead>
              <tbody>
                {filteredMoradores.map((morador) => {
                  const idade = morador.data_nascimento ? calcularIdade(morador.data_nascimento) : null;
                  const condicoes: string[] = [];
                  if (morador.is_hipertenso) condicoes.push('HAS');
                  if (morador.is_diabetico) condicoes.push('DM');
                  if (morador.is_gestante) condicoes.push('Gestante');
                  if (morador.is_domiciliado) condicoes.push('Domiciliado');
                  if (morador.tem_doenca && morador.doencas) condicoes.push(morador.doencas);

                  return (
                    <tr
                      key={morador.id}
                      className="border-b last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedMorador(morador)}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium">{morador.nome}</span>
                          {morador.is_responsavel && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 font-medium">
                              Responsável
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-500">
                        {formatCPF(morador.cpf)}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {idade !== null ? `${idade} anos` : '-'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {morador.residencia?.bairro ?? '-'}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        {morador.agente?.nome ?? '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {condicoes.length > 0 ? condicoes.map((c) => (
                            <span
                              key={c}
                              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                c === 'HAS' ? 'bg-red-100 text-red-700' :
                                c === 'DM' ? 'bg-blue-100 text-blue-700' :
                                c === 'Gestante' ? 'bg-pink-100 text-pink-700' :
                                c === 'Domiciliado' ? 'bg-purple-100 text-purple-700' :
                                'bg-orange-100 text-orange-700'
                              }`}
                            >
                              {c}
                            </span>
                          )) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </div>
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
                Pagina {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
                  Proxima
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedMorador && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Detalhes do Paciente</h2>
              <button
                onClick={() => setSelectedMorador(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Nome</p>
                  <p className="font-medium">{selectedMorador.nome}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">CPF</p>
                  <p className="font-medium">{formatCPF(selectedMorador.cpf)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Cartao SUS</p>
                  <p className="font-medium">{selectedMorador.cartao_sus || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Telefone</p>
                  <p className="font-medium">{selectedMorador.telefone || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Data de Nascimento</p>
                  <p className="font-medium">
                    {selectedMorador.data_nascimento ? formatDate(selectedMorador.data_nascimento) : '-'}
                    {selectedMorador.data_nascimento && ` (${calcularIdade(selectedMorador.data_nascimento)} anos)`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Sexo</p>
                  <p className="font-medium capitalize">{selectedMorador.sexo}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Escolaridade</p>
                  <p className="font-medium">{selectedMorador.escolaridade || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Profissao</p>
                  <p className="font-medium">{selectedMorador.profissao || '-'}</p>
                </div>
              </div>

              {/* Endereco */}
              <div>
                <p className="text-xs text-gray-500">Endereco</p>
                <p className="font-medium">
                  {selectedMorador.residencia
                    ? `${selectedMorador.residencia.logradouro}, ${selectedMorador.residencia.numero} - ${selectedMorador.residencia.bairro}`
                    : '-'}
                </p>
              </div>

              {/* Agente */}
              <div>
                <p className="text-xs text-gray-500">Agente Responsavel</p>
                <p className="font-medium">{selectedMorador.agente?.nome ?? '-'}</p>
              </div>

              {/* Condicoes de saude */}
              <div>
                <p className="text-xs text-gray-500 mb-2">Condições de Saude</p>
                <div className="flex flex-wrap gap-2">
                  {selectedMorador.is_hipertenso && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Hipertenso</span>
                  )}
                  {selectedMorador.is_diabetico && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Diabetico</span>
                  )}
                  {selectedMorador.is_gestante && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-700">Gestante</span>
                  )}
                  {selectedMorador.is_domiciliado && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Domiciliado</span>
                  )}
                  {selectedMorador.tem_doenca && selectedMorador.doencas && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">{selectedMorador.doencas}</span>
                  )}
                  {!selectedMorador.is_hipertenso && !selectedMorador.is_diabetico && !selectedMorador.is_gestante && !selectedMorador.is_domiciliado && !selectedMorador.tem_doenca && (
                    <span className="text-sm text-gray-400">Nenhuma condição registrada</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
