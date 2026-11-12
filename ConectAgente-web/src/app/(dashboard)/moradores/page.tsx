'use client';

import { StatCard } from '@/components/ui/stat-card';
import { useState, useEffect, useCallback } from 'react';
import { usePagination } from '@/hooks/usePagination';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import {
  getMoradores,
  getEstatisticasMoradores,
  getMoradorAuditado,
  buscarMoradoresPorDocumento,
} from '@/services/moradorService';
import type { MoradorComDetalhes } from '@/services/moradorService';
import { cacheGetStale } from '@/lib/cache';
import { formatDate, withTimeout } from '@/lib/utils';
import type { PaginatedResult } from '@/types';
import {
  Search,
  Heart,
  Users,
  Baby,
  Stethoscope,
  Droplets,
  HomeIcon,
  X,
} from 'lucide-react';

function SkeletonRows() {
  return (
    <div className="bg-[var(--superficie)] rounded-xl border overflow-hidden">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b last:border-0 animate-pulse">
          <div className="h-4 bg-[var(--borda-clara)] rounded w-1/4" />
          <div className="h-4 bg-[var(--borda-clara)] rounded w-1/5" />
          <div className="h-4 bg-[var(--borda-clara)] rounded w-1/6" />
          <div className="h-4 bg-[var(--borda-clara)] rounded w-1/6" />
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
  const [abrindoFicha, setAbrindoFicha] = useState(false);
  const [estatisticas, setEstatisticas] = useState(initStats ?? EMPTY_STATS);

  /**
   * Abre a ficha pela função do banco, que registra a leitura.
   *
   * A linha da lista já tem os dados na mão, e seria mais rápido só mostrar.
   * Mas abrir a ficha de uma pessoa é um acesso, e o art. 37 da LGPD pede
   * registro. `fn_ler_morador` grava na mesma transação em que lê, então o
   * registro não depende de o cliente lembrar de avisar.
   */
  // `abrindoFicha` tambem evita abrir duas fichas com dois cliques rapidos:
  // cada abertura grava um registro, e dois registros para um clique duplo
  // sujam a trilha.
  const abrirFicha = useCallback(async (morador: MoradorComDetalhes) => {
    setAbrindoFicha(true);
    try {
      const completo = await getMoradorAuditado(morador.id);
      if (!completo) {
        setError('Você não tem permissão para abrir a ficha deste paciente.');
        return;
      }
      setSelectedMorador({ ...morador, ...completo });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao abrir a ficha.');
    } finally {
      setAbrindoFicha(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (moradores.length === 0) setLoading(true);
    setError('');
    try {
      withTimeout(getEstatisticasMoradores())
        .then(setEstatisticas).catch(() => {});

      const result = await withTimeout(getMoradores(undefined, { page, per_page: perPage }));
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

  // CPF tem 11 dígitos e cartão do SUS 15. Só documento inteiro vai ao banco:
  // a lista não traz mais o documento, e a busca fica registrada na trilha.
  const digitosDaBusca = search.replace(/\D/g, '');
  const buscaPorDocumento = digitosDaBusca.length === 11 || digitosDaBusca.length === 15;
  const [achadosPorDocumento, setAchadosPorDocumento] = useState<MoradorComDetalhes[]>([]);

  useEffect(() => {
    if (!buscaPorDocumento) return;
    let cancelado = false;
    buscarMoradoresPorDocumento(digitosDaBusca)
      .then((achados) => { if (!cancelado) setAchadosPorDocumento(achados); })
      .catch((err) => { if (!cancelado) setError(err instanceof Error ? err.message : 'Erro na busca.'); });
    return () => { cancelado = true; };
  }, [buscaPorDocumento, digitosDaBusca]);

  const filteredMoradores = buscaPorDocumento
    ? achadosPorDocumento
    : search
      ? moradores.filter(
          (m) =>
            m.nome?.toLowerCase().includes(search.toLowerCase()) ||
            m.residencia?.bairro?.toLowerCase().includes(search.toLowerCase())
        )
      : moradores;

  const statCards = [
    { label: 'Total de Pacientes', value: estatisticas.total, icon: Users, color: 'primary' as const },
    { label: 'Hipertensos', value: estatisticas.hipertensos, icon: Heart, color: 'danger' as const },
    { label: 'Diabéticos', value: estatisticas.diabeticos, icon: Droplets, color: 'primary' as const },
    { label: 'Gestantes', value: estatisticas.gestantes, icon: Baby, color: 'pink' as const },
    { label: 'Com Doenças', value: estatisticas.com_doenca, icon: Stethoscope, color: 'warning' as const },
    { label: 'Domiciliados', value: estatisticas.domiciliados, icon: HomeIcon, color: 'info' as const },
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
          <StatCard key={stat.label} title={stat.label} value={stat.value} icon={stat.icon} color={stat.color} />
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--marcador)]" />
        <input
          type="text"
          placeholder="Nome, bairro, ou CPF/SUS completo"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--borda)] text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
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
        <div className="bg-[var(--superficie)] rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-[var(--superficie-alt)]">
                  <th className="text-left px-4 py-3 font-medium text-[var(--texto-claro)]">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--texto-claro)] hidden lg:table-cell">Idade</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--texto-claro)] hidden lg:table-cell">Bairro</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--texto-claro)] hidden xl:table-cell">Agente</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--texto-claro)]">Condições</th>
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
                  // O nome da doença só aparece na ficha, que registra a leitura.
                  if (morador.tem_doenca) condicoes.push('Outras condições');

                  return (
                    <tr
                      key={morador.id}
                      className="border-b last:border-0 hover:bg-[var(--superficie-alt)] cursor-pointer transition-colors"
                      onClick={() => { if (!abrindoFicha) abrirFicha(morador); }}
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
                            <span className="text-[var(--marcador)] text-xs">-</span>
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
            <div className="flex items-center justify-between px-4 py-3 border-t bg-[var(--superficie-alt)]">
              <p className="text-sm text-[var(--texto-claro)]">
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

      {/* Detail Modal */}
      {selectedMorador && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--superficie)] rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Detalhes do Paciente</h2>
              <button
                onClick={() => setSelectedMorador(null)}
                className="text-[var(--marcador)] hover:text-[var(--texto-claro)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[var(--texto-claro)]">Nome</p>
                  <p className="font-medium">{selectedMorador.nome}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--texto-claro)]">CPF</p>
                  <p className="font-medium">{formatCPF(selectedMorador.cpf)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--texto-claro)]">Cartão SUS</p>
                  <p className="font-medium">{selectedMorador.cartao_sus || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--texto-claro)]">Telefone</p>
                  <p className="font-medium">{selectedMorador.telefone || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--texto-claro)]">Data de Nascimento</p>
                  <p className="font-medium">
                    {selectedMorador.data_nascimento ? formatDate(selectedMorador.data_nascimento) : '-'}
                    {selectedMorador.data_nascimento && ` (${calcularIdade(selectedMorador.data_nascimento)} anos)`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--texto-claro)]">Sexo</p>
                  <p className="font-medium capitalize">{selectedMorador.sexo}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--texto-claro)]">Escolaridade</p>
                  <p className="font-medium">{selectedMorador.escolaridade || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--texto-claro)]">Profissao</p>
                  <p className="font-medium">{selectedMorador.profissao || '-'}</p>
                </div>
              </div>

              {/* Endereço */}
              <div>
                <p className="text-xs text-[var(--texto-claro)]">Endereço</p>
                <p className="font-medium">
                  {selectedMorador.residencia
                    ? `${selectedMorador.residencia.logradouro}, ${selectedMorador.residencia.numero} - ${selectedMorador.residencia.bairro}`
                    : '-'}
                </p>
              </div>

              {/* Agente */}
              <div>
                <p className="text-xs text-[var(--texto-claro)]">Agente responsável</p>
                <p className="font-medium">{selectedMorador.agente?.nome ?? '-'}</p>
              </div>

              {/* Condicoes de saude */}
              <div>
                <p className="text-xs text-[var(--texto-claro)] mb-2">Condições de saúde</p>
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
                    <span className="text-sm text-[var(--marcador)]">Nenhuma condição registrada</span>
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
