import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { syncService, SyncStatus } from '../services/syncService';
import { useNetwork } from './NetworkContext';
import { SYNC_INTERVAL_MS } from '../utils/constants';

interface SyncContextData {
  status: SyncStatus;
  sincronizarAgora: () => Promise<void>;
}

const SyncContext = createContext<SyncContextData>({
  status: { sincronizando: false, pendentes: 0, ultimaSync: null, erro: null },
  sincronizarAgora: async () => {},
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

  const sincronizarAgora = useCallback(async () => {
    if (status.sincronizando || !isOnline) return;

    setStatus((s) => ({ ...s, sincronizando: true, erro: null }));

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
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro na sincronização';
      const pendentes = await syncService.contarPendentes();
      setStatus((s) => ({
        ...s,
        sincronizando: false,
        pendentes,
        erro: mensagem,
      }));
    }
  }, [isOnline, status.sincronizando]);

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
