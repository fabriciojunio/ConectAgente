'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Menu, Bell, Search, ChevronDown, X, User, Settings, LogOut, Heart, Users, ClipboardList, Home } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  userName?: string;
  userRole?: string;
  onMenuClick?: () => void;
  onLogout?: () => void | Promise<void>;
}

function getRoleDisplay(role?: string): string {
  const labels: Record<string, string> = {
    admin: 'Administrador',
    supervisor: 'Supervisor',
    gerente: 'Gerente',
    coordenador: 'Coordenador',
    agente: 'Agente',
  };
  return role ? labels[role] || role : '';
}

function getInitials(name: string): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Placeholder notifications — substituir por dados reais quando disponível
const MOCK_NOTIFICATIONS = [
  { id: 1, title: 'Solicitação pendente', body: 'Nova solicitação de cadastro aguarda aprovação.', time: 'Agora', read: false },
  { id: 2, title: 'Meta atingida', body: 'Agentes da Unidade 1 atingiram 80% das visitas.', time: '1h atrás', read: false },
  { id: 3, title: 'Família em atraso', body: '3 famílias sem visita há mais de 30 dias.', time: '3h atrás', read: true },
];

export default function Header({ title, subtitle, userName, userRole, onMenuClick, onLogout }: HeaderProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  return (
    <header
      className="sticky top-0 z-30 h-14 flex items-center justify-between px-4 lg:px-6 shadow-sm"
      style={{
        background: 'linear-gradient(90deg, #0D47A1 0%, #1565C0 50%, #1976D2 100%)',
      }}
    >
      {/* Left: menu + title */}
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Abrir menu"
          >
            <Menu size={22} />
          </button>
        )}
        <div className="hidden sm:block">
          <h1 className="text-sm font-semibold text-white leading-tight">{title}</h1>
          {subtitle && <p className="text-[11px] text-white/60">{subtitle}</p>}
        </div>
      </div>

      {/* Center: search bar */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Buscar..."
            className="w-full pl-9 pr-4 py-1.5 bg-white/10 border border-white/15 rounded-lg text-sm text-white placeholder-white/40 focus:outline-none focus:bg-white/15 focus:border-white/30 transition-all"
          />
        </div>
      </div>

      {/* Right: notifications + user */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(v => !v)}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all relative"
            aria-label="Notificações"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#F44336] rounded-full border border-[#0D47A1]" />
            )}
          </button>

          {/* Dropdown */}
          {notifOpen && (
            <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-2xl border border-[#E5EAF2] z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5EAF2]">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#0F1621]">Notificações</span>
                  {unreadCount > 0 && (
                    <span className="bg-[#1565C0] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[11px] text-[#1565C0] hover:underline font-medium"
                    >
                      Marcar todas
                    </button>
                  )}
                  <button onClick={() => setNotifOpen(false)} className="text-[#9CA3AF] hover:text-[#374151]">
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="max-h-72 overflow-y-auto divide-y divide-[#F4F6FA]">
                {notifications.length === 0 ? (
                  <p className="text-sm text-[#9CA3AF] text-center py-8">Nenhuma notificação</p>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`px-4 py-3 hover:bg-[#F4F6FA] transition-colors cursor-pointer ${!n.read ? 'bg-[#EFF6FF]' : ''}`}
                      onClick={() => setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && <span className="w-2 h-2 rounded-full bg-[#1565C0] mt-1.5 flex-shrink-0" />}
                        {n.read && <span className="w-2 h-2 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[#0F1621]">{n.title}</p>
                          <p className="text-xs text-[#6B7280] leading-snug mt-0.5">{n.body}</p>
                          <p className="text-[10px] text-[#9CA3AF] mt-1">{n.time}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User info with dropdown */}
        {userName && (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(v => !v)}
              className="hidden sm:flex items-center gap-2 ml-2 pl-3 border-l border-white/20 hover:bg-white/10 rounded-lg py-1 px-2 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-xs font-bold text-white">{getInitials(userName)}</span>
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-medium text-white leading-tight">{userName}</p>
                <p className="text-[10px] text-white/60">{getRoleDisplay(userRole)}</p>
              </div>
              <ChevronDown size={14} className={`text-white/50 hidden lg:block transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-12 w-64 bg-white rounded-xl shadow-2xl border border-[#E5EAF2] z-50 overflow-hidden">
                {/* User info header */}
                <div className="px-4 py-3 border-b border-[#E5EAF2] bg-[#F8FAFC]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#1565C0] flex items-center justify-center">
                      <span className="text-sm font-bold text-white">{getInitials(userName)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#0F1621]">{userName}</p>
                      <p className="text-xs text-[#6B7280]">{getRoleDisplay(userRole)}</p>
                    </div>
                  </div>
                </div>

                {/* Quick navigation */}
                <div className="py-1 border-b border-[#E5EAF2]">
                  <p className="px-4 py-1.5 text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">Acesso Rápido</p>
                  <Link
                    href="/"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-[#374151] hover:bg-[#F0F4FA] transition-colors"
                  >
                    <Home size={16} className="text-[#6B7280]" />
                    Dashboard
                  </Link>
                  <Link
                    href="/visitas"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-[#374151] hover:bg-[#F0F4FA] transition-colors"
                  >
                    <ClipboardList size={16} className="text-[#6B7280]" />
                    Visitas
                  </Link>
                  <Link
                    href="/familias"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-[#374151] hover:bg-[#F0F4FA] transition-colors"
                  >
                    <Users size={16} className="text-[#6B7280]" />
                    Famílias
                  </Link>
                  <Link
                    href="/moradores"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-[#374151] hover:bg-[#F0F4FA] transition-colors"
                  >
                    <Heart size={16} className="text-[#6B7280]" />
                    Pacientes / Moradores
                  </Link>
                </div>

                {/* Actions */}
                <div className="py-1">
                  {onLogout && (
                    <button
                      onClick={() => { setUserMenuOpen(false); onLogout(); }}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-[#D32F2F] hover:bg-[#FFEBEE] transition-colors w-full"
                    >
                      <LogOut size={16} />
                      Sair do Sistema
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
