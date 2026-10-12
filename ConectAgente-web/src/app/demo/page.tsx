'use client';

import Link from 'next/link';
import DashboardCards from '@/components/dashboard/DashboardCards';
import type { DashboardStats } from '@/types';
import {
  LayoutDashboard,
  ClipboardList,
  Home,
  Users,
  UserCheck,
  Activity,
  Map,
  FileBarChart,
  LogOut,
} from 'lucide-react';

const DEMO_STATS: DashboardStats = {
  visitas_hoje: 24,
  visitas_semana: 142,
  visitas_mes: 587,
  total_familias: 1243,
  total_moradores: 3891,
  agentes_ativos: 18,
  visitas_realizadas: 562,
  visitas_pendentes: 25,
  taxa_conclusao: 95.7,
};

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Visitas', icon: ClipboardList },
  { label: 'Famílias', icon: Home },
  { label: 'Moradores', icon: Users },
  { label: 'Agentes', icon: UserCheck },
  { label: 'Monitoramento', icon: Activity },
  { label: 'Territorial', icon: Map },
  { label: 'Relatórios', icon: FileBarChart },
];

export default function DemoPage() {
  return (
    <div className="min-h-screen flex bg-[var(--fundo)]">
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: 'var(--primaria)',
          color: '#fff',
          textAlign: 'center',
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: 500,
        }}
      >
        Modo Demonstração, dados simulados.{' '}
        <Link href="/login" className="underline font-semibold">
          Acessar sistema completo
        </Link>
      </div>

      {/* Sidebar */}
      <aside
        className="hidden lg:flex flex-col bg-[var(--superficie)] border-r border-[var(--borda-clara)]"
        style={{ width: 240, paddingTop: 40, flexShrink: 0 }}
      >
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-center gap-2 mb-8">
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--primaria)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              CA
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--primaria-escura)', margin: 0 }}>ConectAgente</p>
              <p style={{ fontSize: 10, color: 'var(--marcador)', margin: 0 }}>Painel de Gestão</p>
            </div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV_ITEMS.map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: 'default',
                  background: item.active ? 'var(--superficie-alt)' : 'transparent',
                  color: item.active ? 'var(--primaria)' : 'var(--texto-claro)',
                  fontWeight: item.active ? 600 : 400,
                }}
              >
                <item.icon size={16} />
                {item.label}
              </div>
            ))}
          </nav>
        </div>

        <div style={{ marginTop: 'auto', padding: '0 16px 24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 0',
              borderTop: '1px solid var(--borda-clara)',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--superficie-alt)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primaria)',
                fontWeight: 700,
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              D
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--texto)', margin: 0 }}>Usuário Demo</p>
              <p style={{ fontSize: 11, color: 'var(--marcador)', margin: 0 }}>Supervisor</p>
            </div>
          </div>
          <Link
            href="/login"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 0',
              fontSize: 13,
              color: 'var(--texto-claro)',
              textDecoration: 'none',
            }}
          >
            <LogOut size={15} />
            Sair da demonstração
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col" style={{ paddingTop: 40, minWidth: 0 }}>
        <header
          style={{
            background: '#fff',
            borderBottom: '1px solid var(--borda-clara)',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--texto)' }}>Dashboard</h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--texto-claro)' }}>Visão geral das operações</p>
          </div>
          <span
            style={{
              background: 'var(--superficie-alt)',
              color: 'var(--primaria)',
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: 999,
            }}
          >
            Demonstração
          </span>
        </header>

        <main style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 24, overflow: 'auto' }}>
          <DashboardCards stats={DEMO_STATS} loading={false} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 24 }}>
            {/* Visitas por semana */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--borda-clara)', padding: 24 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--texto-claro)' }}>
                Visitas por Semana (Mês Atual)
              </h3>
              {[
                { label: 'Semana 1', value: 142 },
                { label: 'Semana 2', value: 165 },
                { label: 'Semana 3', value: 138 },
                { label: 'Semana 4', value: 142 },
              ].map(({ label, value }) => (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: 'var(--texto-claro)' }}>{label}</span>
                    <span style={{ fontWeight: 600, color: 'var(--texto)' }}>{value}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--superficie-alt)', borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        background: 'var(--primaria)',
                        borderRadius: 4,
                        width: `${Math.round((value / 200) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Top agentes */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--borda-clara)', padding: 24 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--texto-claro)' }}>
                Top Agentes, Visitas no Mês
              </h3>
              {[
                { nome: 'Ana Silva', visitas: 48 },
                { nome: 'Carlos Mendes', visitas: 45 },
                { nome: 'Juliana Costa', visitas: 42 },
                { nome: 'Roberto Lima', visitas: 38 },
                { nome: 'Fernanda Souza', visitas: 35 },
              ].map((a) => (
                <div key={a.nome} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'var(--superficie-alt)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primaria)',
                      fontWeight: 700,
                      fontSize: 11,
                      flexShrink: 0,
                    }}
                  >
                    {a.nome[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 500, color: 'var(--texto-medio)' }}>{a.nome}</span>
                      <span style={{ color: 'var(--texto-claro)' }}>{a.visitas}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--superficie-alt)', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          background: 'var(--primaria-clara)',
                          borderRadius: 3,
                          width: `${Math.round((a.visitas / 50) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visitas recentes */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--borda-clara)', padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--texto-claro)' }}>
              Visitas Recentes
            </h3>
            {[
              { familia: 'Família Rodrigues', agente: 'Ana Silva', status: 'Realizada', data: 'Hoje, 09:30' },
              { familia: 'Família Oliveira', agente: 'Carlos Mendes', status: 'Realizada', data: 'Hoje, 08:15' },
              { familia: 'Família Santos', agente: 'Juliana Costa', status: 'Pendente', data: 'Ontem, 15:00' },
              { familia: 'Família Ferreira', agente: 'Roberto Lima', status: 'Realizada', data: 'Ontem, 14:30' },
              { familia: 'Família Pereira', agente: 'Fernanda Souza', status: 'Realizada', data: 'Ontem, 11:00' },
            ].map((v, i) => (
              <div
                key={v.familia}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: i < 4 ? '1px solid var(--superficie-alt)' : 'none',
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--texto)' }}>{v.familia}</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--marcador)' }}>
                    {v.agente} - {v.data}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: v.status === 'Realizada' ? 'var(--sucesso-claro)' : 'var(--alerta-claro)',
                    color: v.status === 'Realizada' ? 'var(--sucesso)' : 'var(--alerta)',
                  }}
                >
                  {v.status}
                </span>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
