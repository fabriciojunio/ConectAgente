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
  { label: 'Familias', icon: Home },
  { label: 'Moradores', icon: Users },
  { label: 'Agentes', icon: UserCheck },
  { label: 'Monitoramento', icon: Activity },
  { label: 'Territorial', icon: Map },
  { label: 'Relatorios', icon: FileBarChart },
];

export default function DemoPage() {
  return (
    <div className="min-h-screen flex bg-[#F4F6FA]">
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: '#1565C0',
          color: '#fff',
          textAlign: 'center',
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: 500,
        }}
      >
        Modo Demonstracao — dados simulados.{' '}
        <Link href="/login" className="underline font-semibold">
          Acessar sistema completo
        </Link>
      </div>

      {/* Sidebar */}
      <aside
        className="hidden lg:flex flex-col bg-white border-r border-gray-200"
        style={{ width: 240, paddingTop: 40, flexShrink: 0 }}
      >
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-center gap-2 mb-8">
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: '#1565C0',
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
              <p style={{ fontWeight: 700, fontSize: 13, color: '#0D47A1', margin: 0 }}>ConectAgente</p>
              <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>Painel de Gestao</p>
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
                  background: item.active ? '#EEF2FF' : 'transparent',
                  color: item.active ? '#1565C0' : '#6B7280',
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
              borderTop: '1px solid #E5E7EB',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#EEF2FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1565C0',
                fontWeight: 700,
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              D
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>Usuario Demo</p>
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Supervisor</p>
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
              color: '#6B7280',
              textDecoration: 'none',
            }}
          >
            <LogOut size={15} />
            Sair da demonstracao
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col" style={{ paddingTop: 40, minWidth: 0 }}>
        <header
          style={{
            background: '#fff',
            borderBottom: '1px solid #E5E7EB',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Dashboard</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>Visao geral das operacoes</p>
          </div>
          <span
            style={{
              background: '#EEF2FF',
              color: '#1565C0',
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: 999,
            }}
          >
            Demonstracao
          </span>
        </header>

        <main style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 24, overflow: 'auto' }}>
          <DashboardCards stats={DEMO_STATS} loading={false} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 24 }}>
            {/* Visitas por semana */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 24 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280' }}>
                Visitas por Semana (Mes Atual)
              </h3>
              {[
                { label: 'Semana 1', value: 142 },
                { label: 'Semana 2', value: 165 },
                { label: 'Semana 3', value: 138 },
                { label: 'Semana 4', value: 142 },
              ].map(({ label, value }) => (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: '#6B7280' }}>{label}</span>
                    <span style={{ fontWeight: 600, color: '#111827' }}>{value}</span>
                  </div>
                  <div style={{ height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        background: '#1565C0',
                        borderRadius: 4,
                        width: `${Math.round((value / 200) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Top agentes */}
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 24 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280' }}>
                Top Agentes - Visitas no Mes
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
                      background: '#EEF2FF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#1565C0',
                      fontWeight: 700,
                      fontSize: 11,
                      flexShrink: 0,
                    }}
                  >
                    {a.nome[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 500, color: '#374151' }}>{a.nome}</span>
                      <span style={{ color: '#6B7280' }}>{a.visitas}</span>
                    </div>
                    <div style={{ height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          background: '#42A5F5',
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
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280' }}>
              Visitas Recentes
            </h3>
            {[
              { familia: 'Familia Rodrigues', agente: 'Ana Silva', status: 'Realizada', data: 'Hoje, 09:30' },
              { familia: 'Familia Oliveira', agente: 'Carlos Mendes', status: 'Realizada', data: 'Hoje, 08:15' },
              { familia: 'Familia Santos', agente: 'Juliana Costa', status: 'Pendente', data: 'Ontem, 15:00' },
              { familia: 'Familia Ferreira', agente: 'Roberto Lima', status: 'Realizada', data: 'Ontem, 14:30' },
              { familia: 'Familia Pereira', agente: 'Fernanda Souza', status: 'Realizada', data: 'Ontem, 11:00' },
            ].map((v, i) => (
              <div
                key={v.familia}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: i < 4 ? '1px solid #F9FAFB' : 'none',
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#111827' }}>{v.familia}</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>
                    {v.agente} - {v.data}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: v.status === 'Realizada' ? '#F0FDF4' : '#FFFBEB',
                    color: v.status === 'Realizada' ? '#15803D' : '#B45309',
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
