'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getSolicitacoes } from '@/services/registroService';
import { cacheGetStale } from '@/lib/cache';
import { withTimeout } from '@/lib/utils';
import type { PaginatedResult } from '@/types';
import { aprovarSolicitacao, rejeitarSolicitacao } from '@/app/actions/registro';
import type { SolicitacaoRegistro } from '@/types';
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  Building,
  FileText,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { usePrimeiraCarga } from '@/hooks/usePrimeiraCarga';

function SkeletonCards() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-[var(--superficie)] rounded-xl border border-[var(--borda-clara)] p-5 animate-pulse">
          <div className="flex flex-col gap-3">
            <div className="h-5 bg-[var(--borda-clara)] rounded w-1/3" />
            <div className="h-4 bg-[var(--borda-clara)] rounded w-1/2" />
            <div className="h-12 bg-[var(--superficie-alt)] rounded w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatCPF(cpf: string): string {
  if (cpf.length !== 11) return cpf;
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const CARGO_LABELS: Record<string, string> = {
  coordenador: 'Coordenador(a)',
  gerente: 'Gerente',
  outro: 'Outro',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pendente: { label: 'Pendente', color: 'var(--alerta)', bg: 'var(--alerta-claro)' },
  aprovado: { label: 'Aprovado', color: 'var(--sucesso)', bg: 'var(--sucesso-claro)' },
  rejeitado: { label: 'Rejeitado', color: 'var(--erro)', bg: 'var(--erro-claro)' },
};

export default function SolicitacoesPage() {
  const { user } = useAuth();

  const initSolicitacoes = cacheGetStale<PaginatedResult<SolicitacaoRegistro>>('solicitacoes_pendente_1_20');

  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoRegistro[]>(initSolicitacoes?.data ?? []);
  const [loading, setLoading] = useState(!initSolicitacoes);
  const [filter, setFilter] = useState('pendente');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [senhaModal, setSenhaModal] = useState<{ id: string; nome: string } | null>(null);
  const [senha, setSenha] = useState('');
  const [rejectModal, setRejectModal] = useState<{ id: string; nome: string } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const primeiraCarga = usePrimeiraCarga(initSolicitacoes != null);

  const loadSolicitacoes = useCallback(async () => {
    if (primeiraCarga.ehAPrimeira()) setLoading(true);
    try {
      const result = await withTimeout(getSolicitacoes(filter || undefined), { data: [], total: 0, page: 1, per_page: 20, total_pages: 0 });
      setSolicitacoes(result.data);
    } catch {
      setFeedback({ type: 'error', message: 'Erro ao carregar solicitações.' });
    } finally {
      setLoading(false);
    }
  }, [filter, primeiraCarga]);

  useEffect(() => {
    loadSolicitacoes();
  }, [loadSolicitacoes]);

  async function handleAprovar() {
    if (!senhaModal || !user || senha.length < 6) return;

    setActionLoading(senhaModal.id);
    try {
      // O id do aprovador nao vai mais daqui: a acao no servidor o tira
      // da sessao. Mandar do cliente era o que permitia aprovar cadastro
      // sem credencial nenhuma.
      const result = await aprovarSolicitacao(senhaModal.id, senha);
      if (result.success) {
        setFeedback({ type: 'success', message: `${senhaModal.nome} foi aprovado(a) com sucesso!` });
        setSenhaModal(null);
        setSenha('');
        loadSolicitacoes();
      } else {
        setFeedback({ type: 'error', message: result.error || 'Erro ao aprovar.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Erro ao aprovar solicitação.' });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRejeitar() {
    if (!rejectModal || !user || !motivo.trim()) return;

    setActionLoading(rejectModal.id);
    try {
      const result = await rejeitarSolicitacao(rejectModal.id, motivo.trim());
      if (result.success) {
        setFeedback({ type: 'success', message: `Solicitação de ${rejectModal.nome} foi rejeitada.` });
        setRejectModal(null);
        setMotivo('');
        loadSolicitacoes();
      } else {
        setFeedback({ type: 'error', message: result.error || 'Erro ao rejeitar.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Erro ao rejeitar solicitação.' });
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="page-container">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Solicitações de Registro</h1>
          <p className="page-subtitle">Gerencie as solicitações de acesso ao sistema</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-[var(--superficie-alt)] rounded-lg p-1">
          {['pendente', 'aprovado', 'rejeitado', ''].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filter === s
                  ? 'bg-[var(--superficie)] text-[var(--primaria)] shadow-sm'
                  : 'text-[var(--texto-claro)] hover:text-[var(--texto-medio)]'
              }`}
            >
              {s === '' ? 'Todas' : s === 'pendente' ? 'Pendentes' : s === 'aprovado' ? 'Aprovadas' : 'Rejeitadas'}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-[var(--sucesso-claro)] text-[var(--sucesso)] border border-[var(--sucesso)]/20'
              : 'bg-[var(--erro-claro)] text-[var(--erro)] border border-[var(--erro)]/20'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {feedback.message}
          <button
            onClick={() => setFeedback(null)}
            className="ml-auto text-current opacity-60 hover:opacity-100"
          >
            &times;
          </button>
        </div>
      )}

      {/* List */}
      {loading && solicitacoes.length === 0 ? (
        <SkeletonCards />
      ) : solicitacoes.length === 0 ? (
        <div className="text-center py-16">
          <Clock size={48} className="text-[var(--borda)] mx-auto mb-3" />
          <p className="text-[var(--texto-claro)]">Nenhuma solicitação encontrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {solicitacoes.map((sol) => {
            const statusConf = STATUS_CONFIG[sol.status] || STATUS_CONFIG.pendente;

            return (
              <div
                key={sol.id}
                className="bg-[var(--superficie)] rounded-xl border border-[var(--borda-clara)] p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  {/* Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-[var(--texto)]">{sol.nome}</h3>
                          <span
                            className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                            style={{ color: statusConf.color, backgroundColor: statusConf.bg }}
                          >
                            {statusConf.label}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--texto-claro)] mt-0.5">
                          CPF: {formatCPF(sol.cpf)} &middot; Solicitado em {formatDate(sol.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-[var(--texto-medio)]">
                        <User size={14} className="text-[var(--texto-claro)]" />
                        <span className="font-medium">
                          {sol.cargo_pretendido === 'outro'
                            ? `Outro: ${sol.cargo_outro || '-'}`
                            : CARGO_LABELS[sol.cargo_pretendido] || sol.cargo_pretendido}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--texto-medio)]">
                        <Building size={14} className="text-[var(--texto-claro)]" />
                        <span>{sol.unidade_saude}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[var(--texto-medio)]">
                        <FileText size={14} className="text-[var(--texto-claro)]" />
                        <span>{sol.area_atuacao}</span>
                      </div>
                    </div>

                    {/* Justificativa */}
                    <div className="bg-[var(--superficie-alt)] rounded-lg p-3 border border-[var(--borda-clara)]">
                      <p className="text-xs font-medium text-[var(--texto-claro)] mb-1">Justificativa:</p>
                      <p className="text-sm text-[var(--texto-medio)]">{sol.justificativa}</p>
                    </div>

                    {sol.motivo_rejeicao && (
                      <div className="bg-[var(--erro-claro)] rounded-lg p-3 border border-[var(--erro)]/10">
                        <p className="text-xs font-medium text-[var(--erro)] mb-1">Motivo da rejeição:</p>
                        <p className="text-sm text-[var(--erro)]/80">{sol.motivo_rejeicao}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {sol.status === 'pendente' && (
                    <div className="flex gap-2 lg:flex-col lg:min-w-[120px]">
                      <button
                        onClick={() => setSenhaModal({ id: sol.id, nome: sol.nome })}
                        disabled={!!actionLoading}
                        className="flex-1 lg:w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-[var(--sucesso)] text-white rounded-lg text-sm font-medium hover:bg-[var(--sucesso)] disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle size={16} />
                        Aprovar
                      </button>
                      <button
                        onClick={() => setRejectModal({ id: sol.id, nome: sol.nome })}
                        disabled={!!actionLoading}
                        className="flex-1 lg:w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-[var(--superficie)] text-[var(--erro)] border border-[var(--erro)]/30 rounded-lg text-sm font-medium hover:bg-[var(--erro-claro)] disabled:opacity-50 transition-colors"
                      >
                        <XCircle size={16} />
                        Rejeitar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Definir senha ao aprovar */}
      {senhaModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--superficie)] rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-[var(--texto)] mb-1">Aprovar {senhaModal.nome}</h3>
            <p className="text-sm text-[var(--texto-claro)] mb-4">
              Defina a senha inicial para o usuário. Ele poderá alterá-la posteriormente.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--texto-medio)] mb-1">
                Senha inicial *
              </label>
              <input
                type="text"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-4 py-2.5 border border-[var(--borda)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primaria)]/30 focus:border-[var(--primaria)]"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setSenhaModal(null); setSenha(''); }}
                className="flex-1 px-4 py-2.5 border border-[var(--borda)] rounded-lg text-sm font-medium text-[var(--texto-claro)] hover:bg-[var(--superficie-alt)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAprovar}
                disabled={senha.length < 6 || !!actionLoading}
                className="flex-1 px-4 py-2.5 bg-[var(--sucesso)] text-white rounded-lg text-sm font-medium hover:bg-[var(--sucesso)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {actionLoading === senhaModal.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle size={16} />
                )}
                Confirmar Aprovação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Motivo da rejeição */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--superficie)] rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-[var(--texto)] mb-1">Rejeitar {rejectModal.nome}</h3>
            <p className="text-sm text-[var(--texto-claro)] mb-4">
              Informe o motivo da rejeição. O solicitante poderá tentar novamente.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--texto-medio)] mb-1">
                Motivo *
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: Cargo não corresponde ao registro no sistema..."
                rows={3}
                className="w-full px-4 py-2.5 border border-[var(--borda)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primaria)]/30 focus:border-[var(--primaria)] resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setRejectModal(null); setMotivo(''); }}
                className="flex-1 px-4 py-2.5 border border-[var(--borda)] rounded-lg text-sm font-medium text-[var(--texto-claro)] hover:bg-[var(--superficie-alt)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRejeitar}
                disabled={!motivo.trim() || !!actionLoading}
                className="flex-1 px-4 py-2.5 bg-[var(--erro)] text-white rounded-lg text-sm font-medium hover:bg-[var(--erro)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {actionLoading === rejectModal.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <XCircle size={16} />
                )}
                Confirmar Rejeição
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
