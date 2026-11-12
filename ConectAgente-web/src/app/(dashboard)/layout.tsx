'use client';

import { useState, useLayoutEffect, useEffect, Suspense } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { usePathname } from 'next/navigation';
import { useAuth, limparDadosLocais } from '@/hooks/useAuth';
import { usePrefetch } from '@/hooks/usePrefetch';
import { useAvisos } from '@/hooks/useAvisos';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import LoadingBar from '@/components/layout/LoadingBar';
import { markHydrated } from '@/lib/cache';
import { signOutAction } from '@/app/actions/auth';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * O "Sair" roda no servidor (apaga o cookie da sessão), mas o cache de
 * pacientes e o perfil ficam no navegador: são apagados aqui antes.
 */
async function sair() {
  limparDadosLocais();
  await signOutAction();
}

const PAGE_TITLES: Record<string, string> = {
  '/': 'Visão geral',
  '/visitas': 'Visitas',
  '/familias': 'Famílias',
  '/moradores': 'Pacientes / Moradores',
  '/agentes': 'Agentes',
  '/monitoramento': 'Monitoramento',
  '/territorial': 'Territorial',
  '/relatorios': 'Relatórios',
  '/admin': 'Administração',
  '/admin/usuarios': 'Gestão de Usuários',
  '/admin/solicitacoes': 'Solicitações de Registro',
  '/minha-area': 'Áreas e equipes',
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  for (const [route, title] of Object.entries(PAGE_TITLES)) {
    if (route !== '/' && pathname.startsWith(route)) return title;
  }
  return 'ConectAgente';
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);
  const pathname = usePathname();

  // 1. Marca hidratacao completa e libera o cache para as paginas.
  //    Roda ANTES do browser pintar (useLayoutEffect).
  //    Muda a key do <main>, forçando as paginas a remontar
  //    com os dados do localStorage disponíveis no useState.
  useIsomorphicLayoutEffect(() => {
    markHydrated();
    setCacheReady(true);
  }, []);

  // 2. Pre-carrega dados de todas as paginas em segundo plano
  usePrefetch();

  const avisos = useAvisos(user);

  // O título da aba diz a página: ajuda quem usa leitor de tela e quem tem
  // várias abas abertas. O cabeçalho mostra papel e recorte, não repete o
  // título que a própria página já tem.
  useEffect(() => {
    document.title = `${getPageTitle(pathname)} | ConectAgente`;
  }, [pathname]);

  return (
    <div className="min-h-screen flex bg-[var(--fundo)]">
      <LoadingBar />

      <Sidebar
        currentPath={pathname}
        // Sem papel conhecido, assume o menor privilégio. O padrão anterior
        // era 'supervisor', papel que o banco nem aceita.
        userRole={user?.role ?? 'agente'}
        userName={user?.nome ?? ''}
        userUnidade={user?.unidade_saude ?? undefined}
        onLogout={sair}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-h-screen lg:ml-60">
        <Header
          userName={user?.nome}
          userRole={user?.role}
          userUnidade={user?.unidade_saude ?? undefined}
          userArea={user?.area_atuacao}
          avisos={avisos}
          onMenuClick={() => setSidebarOpen(true)}
          onLogout={sair}
        />
        {/*
          key muda de 'init' para 'ready' apos markHydrated().
          Isso remonta as paginas, permitindo que useState
          leia dados do localStorage via cacheGetStale.
          Acontece antes do browser pintar, entao o usuario
          nao ve nenhum flash.
        */}
        <main className="flex-1 overflow-auto" key={cacheReady ? 'ready' : 'init'}>
          <ErrorBoundary>
            <Suspense>{children}</Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
