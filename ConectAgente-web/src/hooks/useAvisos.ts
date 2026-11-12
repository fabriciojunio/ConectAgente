'use client';

import { useEffect, useState } from 'react';
import { withTimeout } from '@/lib/utils';
import { contarSolicitacoesPendentes } from '@/services/registroService';
import { getAlertasAtraso } from '@/services/dashboardService';
import type { AuthUser } from '@/types';

export interface Aviso {
  id: 'area' | 'solicitacoes' | 'atraso';
  titulo: string;
  texto: string;
  href: string;
  tom: 'primary' | 'warning' | 'danger';
}

export interface EstadoAvisos {
  avisos: Aviso[];
  carregando: boolean;
  falhou: boolean;
}

const DIAS_SEM_VISITA = 30;

function plural(n: number, um: string, varios: string): string {
  return `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;
}

/**
 * Avisos do cabeçalho, todos calculados do banco no momento em que a tela
 * abre. Nada aqui é texto fixo: cada aviso só aparece se o número existir,
 * e cada um leva à página onde se resolve.
 *
 * O que cada papel vê segue o RLS: a contagem de famílias em atraso vem da
 * mesma função do monitoramento, que já recorta pela unidade de quem pede.
 */
export function useAvisos(user: AuthUser | null): EstadoAvisos {
  const [estado, setEstado] = useState<EstadoAvisos>({ avisos: [], carregando: true, falhou: false });
  const id = user?.id;
  const role = user?.role;
  const semArea = role === 'coordenador' && !user?.unidade_saude?.trim();

  useEffect(() => {
    if (!id) return;
    let ativo = true;

    async function carregar() {
      const avisos: Aviso[] = [];
      let falhou = false;

      if (semArea) {
        avisos.push({
          id: 'area',
          titulo: 'Escolha a sua área',
          texto: 'Sua conta ainda não tem unidade. Defina para ver os dados da sua equipe.',
          href: '/minha-area',
          tom: 'primary',
        });
      }

      const [solicitacoes, atraso] = await Promise.allSettled([
        role === 'admin' ? withTimeout(contarSolicitacoesPendentes()) : Promise.resolve(0),
        withTimeout(getAlertasAtraso(DIAS_SEM_VISITA)).then((l) => l.length),
      ]);

      if (solicitacoes.status === 'fulfilled' && solicitacoes.value > 0) {
        avisos.push({
          id: 'solicitacoes',
          titulo: 'Cadastros para analisar',
          texto: `${plural(solicitacoes.value, 'solicitação espera', 'solicitações esperam')} aprovação.`,
          href: '/admin/solicitacoes',
          tom: 'warning',
        });
      }
      if (atraso.status === 'fulfilled' && atraso.value > 0) {
        avisos.push({
          id: 'atraso',
          titulo: 'Famílias sem visita',
          texto: `${plural(atraso.value, 'família está', 'famílias estão')} há mais de ${DIAS_SEM_VISITA} dias sem visita.`,
          href: '/monitoramento',
          tom: 'danger',
        });
      }
      if (solicitacoes.status === 'rejected' || atraso.status === 'rejected') falhou = true;

      if (ativo) setEstado({ avisos, carregando: false, falhou });
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, [id, role, semArea]);

  return estado;
}
