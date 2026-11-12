'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, ChevronDown, LogOut, MapPinned, Menu, ShieldCheck } from 'lucide-react';
import { SeletorTema } from './SeletorTema';
import { cn } from '@/lib/utils';
import type { EstadoAvisos } from '@/hooks/useAvisos';
import type { UserRole } from '@/types';

interface HeaderProps {
  userName?: string;
  userRole?: UserRole;
  userUnidade?: string;
  userArea?: string;
  avisos: EstadoAvisos;
  onMenuClick?: () => void;
  onLogout?: () => void | Promise<void>;
}

const PAPEL: Record<UserRole, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  coordenador: 'Coordenação',
  agente: 'Agente',
};

/** Diz de onde vêm os números da tela: o mesmo recorte que o RLS aplica. */
export function escopoDoPapel(role?: UserRole, unidade?: string, area?: string): string {
  if (role === 'admin' || role === 'gerente') return 'Todas as unidades';
  if (role === 'coordenador') return unidade?.trim() ? unidade : 'Área ainda não definida';
  if (role === 'agente') return area?.trim() ? `Área ${area}` : 'Seus pacientes';
  return '';
}

export function iniciais(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const corDoAviso = {
  primary: 'bg-primary-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
} as const;

export default function Header({
  userName,
  userRole,
  userUnidade,
  userArea,
  avisos,
  onMenuClick,
  onLogout,
}: HeaderProps) {
  const [avisosAbertos, setAvisosAbertos] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const avisosRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fora(e: MouseEvent) {
      if (avisosRef.current && !avisosRef.current.contains(e.target as Node)) setAvisosAbertos(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAberto(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setAvisosAbertos(false);
        setMenuAberto(false);
      }
    }
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, []);

  const total = avisos.avisos.length;
  const escopo = escopoDoPapel(userRole, userUnidade, userArea);
  const gerenciaArea = userRole === 'coordenador' || userRole === 'gerente' || userRole === 'admin';

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center justify-between gap-3 px-3 sm:px-4 lg:px-6 bg-[var(--faixa)] text-[var(--sobre-faixa)]">
      <div className="flex items-center gap-3 min-w-0">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md"
            aria-label="Abrir menu"
          >
            <Menu size={22} />
          </button>
        )}
        {userRole && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
            <ShieldCheck size={13} aria-hidden="true" />
            {PAPEL[userRole]}
          </span>
        )}
        {escopo && (
          <span className="hidden sm:inline truncate text-sm text-white/80" title="Recorte dos dados desta conta">
            {escopo}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <SeletorTema />

        <div className="relative" ref={avisosRef}>
          <button
            onClick={() => setAvisosAbertos((v) => !v)}
            className="relative p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md"
            aria-label={total > 0 ? `Avisos: ${total}` : 'Avisos'}
            aria-haspopup="true"
            aria-expanded={avisosAbertos}
          >
            <Bell size={18} />
            {total > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-danger-500 text-[10px] font-bold leading-4 text-white text-center">
                {total}
              </span>
            )}
          </button>

          {avisosAbertos && (
            <div className="absolute right-0 top-11 w-[min(20rem,calc(100vw-1.5rem))] bg-[var(--superficie)] text-[var(--texto)] rounded-[var(--radius)] shadow-xl border border-[var(--borda-clara)] z-50 overflow-hidden">
              <p className="px-4 py-2.5 text-sm font-semibold border-b border-[var(--borda-clara)]">Avisos</p>
              {avisos.carregando ? (
                <p className="px-4 py-6 text-sm text-[var(--texto-claro)]">Conferindo…</p>
              ) : total === 0 ? (
                <p className="px-4 py-6 text-sm text-[var(--texto-claro)]">Nenhum aviso agora.</p>
              ) : (
                <ul className="divide-y divide-[var(--borda-clara)]">
                  {avisos.avisos.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={a.href}
                        onClick={() => setAvisosAbertos(false)}
                        className="flex gap-3 px-4 py-3 hover:bg-[var(--superficie-alt)]"
                      >
                        <span className={cn('mt-1.5 h-2 w-2 flex-shrink-0 rounded-full', corDoAviso[a.tom])} aria-hidden="true" />
                        <span>
                          <span className="block text-[13px] font-semibold">{a.titulo}</span>
                          <span className="block text-xs text-[var(--texto-claro)] leading-snug mt-0.5">{a.texto}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {avisos.falhou && (
                <p className="px-4 py-2 text-xs text-[var(--alerta)] border-t border-[var(--borda-clara)]">
                  Parte dos avisos não carregou. Recarregue a página para tentar de novo.
                </p>
              )}
            </div>
          )}
        </div>

        {userName && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuAberto((v) => !v)}
              className="flex items-center gap-2 ml-1 sm:pl-3 sm:border-l border-white/20 hover:bg-white/10 rounded-md py-1 px-1.5"
              aria-haspopup="true"
              aria-expanded={menuAberto}
              aria-label={`Conta de ${userName}`}
            >
              <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                {iniciais(userName)}
              </span>
              <span className="hidden lg:block text-left max-w-[180px]">
                <span className="block text-xs font-semibold leading-tight truncate">{userName}</span>
              </span>
              <ChevronDown size={14} className={cn('hidden lg:block text-white/60 transition-transform', menuAberto && 'rotate-180')} />
            </button>

            {menuAberto && (
              <div className="absolute right-0 top-12 w-64 bg-[var(--superficie)] text-[var(--texto)] rounded-[var(--radius)] shadow-xl border border-[var(--borda-clara)] z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--borda-clara)]">
                  <p className="text-sm font-semibold truncate">{userName}</p>
                  <p className="text-xs text-[var(--texto-claro)]">
                    {userRole ? PAPEL[userRole] : ''}
                    {escopo ? ` · ${escopo}` : ''}
                  </p>
                </div>
                <div className="py-1">
                  {gerenciaArea && (
                    <Link
                      href="/minha-area"
                      onClick={() => setMenuAberto(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-[var(--texto-medio)] hover:bg-[var(--superficie-alt)]"
                    >
                      <MapPinned size={16} className="text-[var(--texto-claro)]" />
                      {userRole === 'coordenador' ? 'Minha área' : 'Áreas e equipes'}
                    </Link>
                  )}
                  {onLogout && (
                    <button
                      onClick={() => {
                        setMenuAberto(false);
                        void onLogout();
                      }}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-[var(--erro)] hover:bg-[var(--erro-claro)] w-full"
                    >
                      <LogOut size={16} />
                      Sair
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
