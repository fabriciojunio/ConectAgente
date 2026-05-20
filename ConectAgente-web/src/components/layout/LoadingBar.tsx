'use client';

import { usePrefetchProgress } from '@/hooks/usePrefetch';

/**
 * Barra fina de progresso no topo da tela.
 * Mostra o carregamento em segundo plano de todos os dados.
 * Desaparece automaticamente quando tudo carregou.
 */
export default function LoadingBar() {
  const { pct, done } = usePrefetchProgress();

  if (done) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-1 bg-transparent pointer-events-none">
      <div
        className="h-full bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 transition-all duration-300 ease-out shadow-sm shadow-blue-400/50"
        style={{ width: `${Math.max(pct, 5)}%` }}
      />
    </div>
  );
}
