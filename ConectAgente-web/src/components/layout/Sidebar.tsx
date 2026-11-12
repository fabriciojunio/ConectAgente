'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  UserCheck,
  AlertTriangle,
  Map,
  FileText,
  FileBarChart,
  Settings,
  LogOut,
  Shield,
  UserPlus,
  UserCog,
  Activity,
  Heart,
  MapPinned,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SIDEBAR_ITEMS } from '@/lib/constants';
import { prefetchByRoute } from '@/lib/prefetchRoutes';
import type { UserRole } from '@/types';

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard,
  ClipboardList,
  Users,
  UserCheck,
  AlertTriangle,
  Map,
  FileText,
  Settings,
  Shield,
  UserPlus,
  UserCog,
  Activity,
  FileBarChart,
  Heart,
  MapPinned,
};

interface SidebarProps {
  currentPath: string;
  userRole: UserRole;
  userName: string;
  userUnidade?: string;
  onLogout: () => void | Promise<void>;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({
  currentPath,
  userRole,
  userUnidade,
  onLogout,
  isOpen = true,
  onClose,
}: SidebarProps) {
  const filteredItems = SIDEBAR_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  // Ao passar o mouse sobre um link, pre-carrega os dados dessa pagina
  const handleMouseEnter = useCallback((href: string) => {
    prefetchByRoute(href);
  }, []);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-60 z-50 flex flex-col transition-transform duration-300 ease-in-out bg-[var(--superficie)] border-r border-[var(--borda-clara)]',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo area */}
        <div className="h-14 px-4 flex items-center gap-3 border-b border-[var(--borda-clara)] flex-shrink-0">
          {/* Close button on mobile */}
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-[var(--texto-claro)] hover:text-[var(--texto)] lg:hidden p-1"
              aria-label="Fechar menu"
            >
              <X size={18} />
            </button>
          )}

          <Image
            src="/logo.png"
            alt="ConectAgente"
            width={36}
            height={36}
            className="object-contain rounded-lg flex-shrink-0"
          />
          <div>
            <p className="text-sm font-extrabold text-[var(--primaria-escura)] leading-tight">
              ConectAgente
            </p>
            {userUnidade && (
              <p className="text-[10px] text-[var(--texto-claro)] font-medium truncate max-w-[140px]">
                {userUnidade}
              </p>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 scrollbar-thin" aria-label="Menu principal">
          <div className="space-y-0.5">
            {filteredItems.map((item) => {
              const Icon = iconMap[item.icon] || LayoutDashboard;
              const pathMatches =
                currentPath === item.href ||
                (item.href !== '/' && currentPath.startsWith(item.href + '/'));
              const moreSpecificExists = filteredItems.some(
                (other) =>
                  other.href !== item.href &&
                  other.href.length > item.href.length &&
                  (currentPath === other.href || currentPath.startsWith(other.href + '/'))
              );
              const isActive = pathMatches && !moreSpecificExists;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  onMouseEnter={() => handleMouseEnter(item.href)}
                  className={cn(
                    'relative flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700 font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-[var(--primaria)]'
                      : 'text-[var(--texto-medio)] hover:bg-[var(--superficie-alt)] hover:text-[var(--texto)]'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={18} className={isActive ? 'text-primary-600' : 'text-[var(--texto-claro)]'} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Logout at bottom */}
        <div className="border-t border-[var(--borda-clara)] p-2">
          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-[var(--texto-claro)] hover:text-[var(--erro)] hover:bg-[var(--erro-claro)] transition-all w-full"
            aria-label="Sair do sistema"
          >
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
