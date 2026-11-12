import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { syncService, SyncStatus } from '../services/syncService';
import { syncQueueRepository } from '../database/repositories/syncQueueRepository';
import { useNetwork } from './NetworkContext';
import { SYNC_INTERVAL_MS } from '../utils/constants';

/** O que a última tentativa deu, para quem pediu a sincronização mostrar. */
export interface ResultadoDaSincronizacao {
  ok: boolean;
  erro: string | null;
  pendentes: number;
}

interface SyncContextData {
  status: SyncStatus;
  /** `reabrirErros`: o agente pediu para tentar de novo o que já tinha desistido. */
  sincronizarAgora: (opcoes?: { reabrirErros?: boolean }) => Promise<ResultadoDaSincronizacao>;
}

const SyncContext = createContext<SyncContextData>({
  status: { sincronizando: false, pendentes: 0, ultimaSync: null, erro: null },
  sincronizarAgora: async () => ({ ok: true, erro: null, pendentes: 0 }),
});

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { isOnline } = useNetwork();
  const [status, setStatus] = useState<SyncStatus>({
    sincronizando: false,
    pendentes: 0,
    ultimaSync: null,
    erro: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sincronizarAgora = useCallback(async (opcoes?: { reabrirErros?: boolean }): Promise<ResultadoDaSincronizacao> => {
    if (status.sincronizando || !isOnline) {
      return { ok: false, erro: isOnline ? null : 'sem rede', pendentes: status.pendentes };
    }

    setStatus((s) => ({ ...s, sincronizando: true, erro: null }));
    if (opcoes?.reabrirErros) await syncQueueRepository.reabrirComErro().catch(() => 0);

    try {
      await syncService.sincronizar((progress, total) => {
        // Atualizar progresso se necessário
      });
      const pendentes = await syncService.contarPendentes();
      setStatus({
        sincronizando: false,
        pendentes,
        ultimaSync: new Date().toISOString(),
        erro: null,
      });
      return { ok: true, erro: null, pendentes };
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro na sincronização';
      const pendentes = await syncService.contarPendentes();
      setStatus((s) => ({
        ...s,
        sincronizando: false,
        pendentes,
        erro: mensagem,
      }));
      return { ok: false, erro: mensagem, pendentes };
    }
  }, [isOnline, status.sincronizando, status.pendentes]);

  // Sincronizar quando o agente volta para o aplicativo. Com o celular em
  // segundo plano o Android adia a tarefa periódica; quem abre o app depois
  // de uma visita sem sinal não deveria esperar o próximo ciclo.
  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active' && isOnline) void sincronizarAgora();
    });
    return () => assinatura.remove();
  }, [isOnline, sincronizarAgora]);

  // Sincronizar quando volta para online
  useEffect(() => {
    if (isOnline) {
      sincronizarAgora();
    }
  }, [isOnline]);

  // Sincronizar periodicamente quando online
  useEffect(() => {
    if (isOnline) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(sincronizarAgora, SYNC_INTERVAL_MS);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOnline, sincronizarAgora]);

  // Atualizar contagem de pendentes periodicamente
  useEffect(() => {
    const interval = setInterval(async () => {
      const pendentes = await syncService.contarPendentes();
      setStatus((s) => ({ ...s, pendentes }));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SyncContext.Provider value={{ status, sincronizarAgora }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextData {
  return useContext(SyncContext);
}
