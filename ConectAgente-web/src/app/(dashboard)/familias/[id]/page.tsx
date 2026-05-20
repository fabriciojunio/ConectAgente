'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getFamiliaById, getHistoricoVisitas } from '@/services/familiaService';
import { formatDate, formatCPF, calcularDiasSemVisita, withTimeout } from '@/lib/utils';
import type { ResidenciaComDetalhes, Visita } from '@/types';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Loader2,
  ArrowLeft,
  MapPin,
  Home,
  User,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
  realizada: { label: 'Realizada', icon: CheckCircle, className: 'text-green-600 bg-green-50' },
  agendada: { label: 'Agendada', icon: Clock, className: 'text-blue-600 bg-blue-50' },
  cancelada: { label: 'Cancelada', icon: XCircle, className: 'text-red-600 bg-red-50' },
  nao_encontrado: { label: 'Não Encontrado', icon: AlertCircle, className: 'text-yellow-600 bg-yellow-50' },
};

export default function FamiliaDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [familia, setFamilia] = useState<ResidenciaComDetalhes | null>(null);
  const [historicoVisitas, setHistoricoVisitas] = useState<Visita[]>([]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError('');
      try {
        const [familiaData, visitasData] = await Promise.all([
          withTimeout(getFamiliaById(id), null),
          withTimeout(getHistoricoVisitas(id), []),
        ]);

        if (!familiaData) {
          setError('Família não encontrada');
          return;
        }

        setFamilia(familiaData);
        setHistoricoVisitas(visitasData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados da família');
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

  if (error || !familia) {
    return (
      <div className="page-container">
        <Link href="/familias" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Famílias
        </Link>
        <EmptyState title="Erro" description={error || 'Família não encontrada'} />
      </div>
    );
  }

  const ultimaVisita = historicoVisitas[0]?.data_visita;
  const diasSemVisita = ultimaVisita ? calcularDiasSemVisita(ultimaVisita) : null;

  return (
    <div className="page-container">
      <Link href="/familias" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
        <ArrowLeft className="w-4 h-4" />
        Voltar para Famílias
      </Link>

      {/* Residence Info Card */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Home className="w-5 h-5 text-primary-600" />
          Informações da Residência
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Endereço</p>
            <p className="text-sm font-medium flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-gray-400" />
              {familia.logradouro}, {familia.numero}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Bairro</p>
            <p className="text-sm font-medium">{familia.bairro}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Cidade</p>
            <p className="text-sm font-medium">{familia.cidade}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Agente Responsável</p>
            <p className="text-sm font-medium">{familia.agente?.nome ?? 'Não atribuído'}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary-50 text-primary-600">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total de Visitas</p>
            <p className="text-xl font-bold">{historicoVisitas.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-50 text-green-600">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Última Visita</p>
            <p className="text-xl font-bold">{ultimaVisita ? formatDate(ultimaVisita) : 'Nunca'}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <div className={`p-2 rounded-lg ${diasSemVisita && diasSemVisita > 30 ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'}`}>
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Dias sem Visita</p>
            <p className="text-xl font-bold">{diasSemVisita ?? '-'}</p>
          </div>
        </div>
      </div>

      {/* Moradores Table */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="section-title flex items-center gap-2">
          <User className="w-5 h-5 text-primary-600" />
          Moradores
        </h3>
        {familia.moradores && familia.moradores.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">CPF</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Data Nasc.</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Condições</th>
                </tr>
              </thead>
              <tbody>
                {familia.moradores.map((morador) => (
                  <tr key={morador.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{morador.nome}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {morador.cpf ? formatCPF(morador.cpf) : '-'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {morador.data_nascimento ? formatDate(morador.data_nascimento) : '-'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {morador.doencas || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Nenhum morador cadastrado.</p>
        )}
      </div>

      {/* Visit History with Timeline */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="section-title flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary-600" />
          Histórico de Visitas
        </h3>
        {historicoVisitas.length > 0 ? (
          <div className="space-y-0">
            {historicoVisitas.map((visita, index) => {
              const config = statusConfig[visita.status] ?? statusConfig.realizada;
              const Icon = config.icon;
              return (
                <div key={visita.id} className="flex gap-4">
                  {/* Timeline line */}
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config.className}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    {index < historicoVisitas.length - 1 && (
                      <div className="w-0.5 flex-1 bg-gray-200 my-1" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="pb-6 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium">{formatDate(visita.data_visita)}</p>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
                        {config.label}
                      </span>
                    </div>
                    {visita.observacoes && (
                      <p className="text-sm text-gray-600">{visita.observacoes}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Nenhuma visita registrada.</p>
        )}
      </div>
    </div>
  );
}
