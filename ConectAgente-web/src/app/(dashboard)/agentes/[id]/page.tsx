'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getAgenteById, getAgenteFamilias } from '@/services/agenteService';
import { getVisitasByAgente } from '@/services/visitaService';
import { formatDate, calcularDiasSemVisita, getNivelCriticidade, getCriticidadeColor, withTimeout } from '@/lib/utils';
import VisitasLineChart from '@/components/charts/VisitasLineChart';
import { EmptyState } from '@/components/ui/empty-state';
import type { VisitaComDetalhes } from '@/types';
import {
  Loader2,
  ArrowLeft,
  User,
  MapPin,
  Calendar,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';

interface AgenteDetail {
  id: string;
  nome: string;
  unidade_saude?: string;
  area_atuacao?: string;
  microarea?: string;
  ativo?: boolean;
  familias?: Array<{
    id: string;
    logradouro: string;
    numero: string;
    bairro: string;
    ultima_visita?: string;
  }>;
}

interface AgentePerformance {
  visitas_hoje: number;
  visitas_semana: number;
  visitas_mes: number;
  taxa_conclusao: number;
  visitas_por_dia: Array<{ data: string; realizadas: number; canceladas: number; nao_encontrado: number }>;
}

export default function AgenteDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agente, setAgente] = useState<AgenteDetail | null>(null);
  const [performance, setPerformance] = useState<AgentePerformance | null>(null);
  const [visitasRecentes, setVisitasRecentes] = useState<VisitaComDetalhes[]>([]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError('');
      try {
        const [agenteData, visitasData, familiasData] = await Promise.all([
          withTimeout(getAgenteById(id), null),
          withTimeout(getVisitasByAgente(id), []),
          withTimeout(getAgenteFamilias(id), []),
        ]);

        if (!agenteData) {
          setError('Agente não encontrado');
          return;
        }

        // Build ultima_visita map from visits
        const ultimaVisitaMap = new Map<string, string>();
        for (const v of visitasData) {
          const resId = v.residencia_id;
          if (resId && v.data_visita) {
            const current = ultimaVisitaMap.get(resId);
            if (!current || v.data_visita > current) {
              ultimaVisitaMap.set(resId, v.data_visita);
            }
          }
        }

        // Map familias with computed ultima_visita
        const familias = familiasData.map((f) => ({
          id: f.id,
          logradouro: f.logradouro,
          numero: f.numero,
          bairro: f.bairro,
          ultima_visita: ultimaVisitaMap.get(f.id),
        }));

        setAgente({ ...agenteData, familias });

        // Compute performance from visits data
        const hoje = new Date().toISOString().split('T')[0];
        const semanaInicio = new Date();
        semanaInicio.setDate(semanaInicio.getDate() - 7);
        const mesInicio = new Date();
        mesInicio.setDate(1);

        const total = visitasData.length;
        const realizadas = visitasData.filter((v) => v.status === 'realizada').length;
        setPerformance({
          visitas_hoje: visitasData.filter((v) => v.data_visita?.startsWith(hoje)).length,
          visitas_semana: visitasData.filter((v) => new Date(v.data_visita) >= semanaInicio).length,
          visitas_mes: visitasData.filter((v) => new Date(v.data_visita) >= mesInicio).length,
          taxa_conclusao: total > 0 ? Math.round((realizadas / total) * 1000) / 10 : 0,
          visitas_por_dia: [],
        });
        setVisitasRecentes(visitasData.slice(0, 20));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados do agente');
      } finally {
        setLoading(false);
      }
    }

    if (id) fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="page-container flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error || !agente) {
    return (
      <div className="page-container">
        <Link href="/agentes" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Agentes
        </Link>
        <EmptyState title="Erro" description={error || 'Agente não encontrado'} />
      </div>
    );
  }

  const performanceCards = [
    { label: 'Visitas Hoje', value: performance?.visitas_hoje ?? 0, icon: Calendar, color: 'text-primary-600 bg-primary-50' },
    { label: 'Visitas Semana', value: performance?.visitas_semana ?? 0, icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
    { label: 'Visitas Mês', value: performance?.visitas_mes ?? 0, icon: CheckCircle, color: 'text-green-600 bg-green-50' },
    { label: 'Taxa de Conclusão', value: `${performance?.taxa_conclusao ?? 0}%`, icon: TrendingUp, color: 'text-purple-600 bg-purple-50' },
  ];

  return (
    <div className="page-container">
      <Link href="/agentes" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
        <ArrowLeft className="w-4 h-4" />
        Voltar para Agentes
      </Link>

      {/* Agent Info Card */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <User className="w-7 h-7 text-primary-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold text-gray-900">{agente.nome}</h2>
              <span
                className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  agente.ativo !== false
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {agente.ativo !== false ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-2">
              {agente.unidade_saude && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {agente.unidade_saude}
                </span>
              )}
              {agente.area_atuacao && (
                <span>Área: {agente.area_atuacao}</span>
              )}
              {agente.microarea && (
                <span>Microárea: {agente.microarea}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="card-grid">
        {performanceCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Visit Chart */}
      {performance?.visitas_por_dia && performance.visitas_por_dia.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="section-title">Visitas nos Últimos 30 Dias</h3>
          <VisitasLineChart
            data={performance.visitas_por_dia.map((v) => ({
              data: v.data,
              total_visitas: v.realizadas + v.canceladas + v.nao_encontrado,
              realizadas: v.realizadas,
              canceladas: v.canceladas,
              nao_encontrado: v.nao_encontrado,
            }))}
            loading={false}
          />
        </div>
      )}

      {/* Assigned Families */}
      {agente.familias && agente.familias.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="section-title">Famílias Atribuídas</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Endereço</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Bairro</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Última Visita</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {agente.familias.map((familia) => {
                  const dias = familia.ultima_visita
                    ? calcularDiasSemVisita(familia.ultima_visita)
                    : 999;
                  const criticidade = getNivelCriticidade(dias);

                  return (
                    <tr key={familia.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/familias/${familia.id}`} className="text-primary-600 hover:underline">
                          {familia.logradouro}, {familia.numero}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{familia.bairro}</td>
                      <td className="px-4 py-3">
                        {familia.ultima_visita ? formatDate(familia.ultima_visita) : 'Nunca'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getCriticidadeColor(criticidade)}`}>
                          {criticidade === 'normal' ? 'Normal' : criticidade === 'atencao' ? 'Atenção' : criticidade === 'alerta' ? 'Alerta' : 'Crítico'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Visits */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="section-title">Visitas Recentes</h3>
        {visitasRecentes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Endereço</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Observações</th>
                </tr>
              </thead>
              <tbody>
                {visitasRecentes.map((visita) => (
                  <tr key={visita.id} className="border-b last:border-0">
                    <td className="px-4 py-3">{formatDate(visita.data_visita)}</td>
                    <td className="px-4 py-3">
                      {visita.residencia
                        ? `${visita.residencia.logradouro}, ${visita.residencia.numero}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          visita.status === 'realizada'
                            ? 'bg-green-100 text-green-700'
                            : visita.status === 'cancelada'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {visita.status === 'realizada'
                          ? 'Realizada'
                          : visita.status === 'cancelada'
                          ? 'Cancelada'
                          : visita.status === 'agendada'
                          ? 'Agendada'
                          : 'Não Encontrado'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell max-w-[200px] truncate">
                      {visita.observacoes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Nenhuma visita registrada.</p>
        )}
      </div>

      {/* Families with delay */}
      {agente.familias && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="section-title flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Famílias com Atraso
          </h3>
          {(() => {
            const familiasAtraso = agente.familias.filter((f) => {
              const dias = f.ultima_visita ? calcularDiasSemVisita(f.ultima_visita) : 999;
              return dias > 15;
            });
            if (familiasAtraso.length === 0) {
              return <p className="text-sm text-gray-500">Nenhuma família com atraso de visita.</p>;
            }
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Endereço</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Bairro</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Dias sem Visita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {familiasAtraso.map((familia) => {
                      const dias = familia.ultima_visita
                        ? calcularDiasSemVisita(familia.ultima_visita)
                        : 999;
                      return (
                        <tr key={familia.id} className="border-b last:border-0">
                          <td className="px-4 py-3">
                            <Link href={`/familias/${familia.id}`} className="text-primary-600 hover:underline">
                              {familia.logradouro}, {familia.numero}
                            </Link>
                          </td>
                          <td className="px-4 py-3">{familia.bairro}</td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-red-600">{dias > 900 ? '-' : dias} dias</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
