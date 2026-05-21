'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { checkLoginRateLimit } from '@/app/actions/login';
import { Eye, EyeOff, Shield } from 'lucide-react';

const loginSchema = z.object({
  cpf: z.string().min(11, 'CPF inválido').max(14),
  senha: z.string().min(1, 'Senha obrigatória'),
});

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function stripCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

export default function LoginPage() {
  const router = useRouter();
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const stripped = stripCPF(cpf);
    const result = loginSchema.safeParse({ cpf: stripped, senha });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setLoading(true);

    // Server-side rate limit check
    const rateLimitResult = await checkLoginRateLimit(stripped);
    if (!rateLimitResult.allowed) {
      setError(rateLimitResult.error ?? 'Muitas tentativas. Aguarde.');
      setLoading(false);
      return;
    }

    // Safety net: force reset if everything hangs
    const safetyTimer = setTimeout(() => {
      setLoading(false);
      setError('Tempo limite excedido. Verifique sua conexão e tente novamente.');
    }, 15000);

    try {
      const supabase = createClient();
      const email = `${stripped}@conectagente.local`;

      // Auth call with timeout to avoid infinite hang
      const authTimeout = new Promise<{ error: Error }>((_resolve, reject) =>
        setTimeout(() => reject(new Error('timeout')), 10000)
      );

      const { error: authError } = await Promise.race([
        supabase.auth.signInWithPassword({ email, password: senha }),
        authTimeout,
      ]) as { error: Error | null };

      if (authError) {
        clearTimeout(safetyTimer);
        setError('CPF ou senha inválidos');
        setLoading(false);
        return;
      }

      // Check role/status with timeout
      const agenteTimeout = new Promise<{ data: null; error: Error }>((_resolve, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000)
      );

      const { data: agente } = await Promise.race([
        supabase.from('agentes').select('role, ativo').eq('cpf', stripped).maybeSingle(),
        agenteTimeout,
      ]) as { data: { role: string; ativo: boolean } | null; error: unknown };

      if (!agente || !agente.ativo) {
        await supabase.auth.signOut();
        clearTimeout(safetyTimer);
        setError('Usuário inativo. Entre em contato com o administrador.');
        setLoading(false);
        return;
      }

      if (agente.role === 'agente') {
        await supabase.auth.signOut();
        clearTimeout(safetyTimer);
        setError('Acesso restrito. Apenas supervisores e administradores podem usar o painel web.');
        setLoading(false);
        return;
      }

      clearTimeout(safetyTimer);
      router.push('/');
    } catch (err) {
      clearTimeout(safetyTimer);
      const isTimeout = err instanceof Error && err.message === 'timeout';
      setError(
        isTimeout
          ? 'Conexão lenta. Verifique sua internet e tente novamente.'
          : 'Erro ao conectar. Tente novamente.'
      );
    } finally {
      clearTimeout(safetyTimer);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Login Form */}
      <div className="w-full lg:w-[480px] xl:w-[520px] flex flex-col bg-white">
        {/* Logo and branding */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="ConectAgente"
              width={44}
              height={44}
              className="object-contain rounded-xl"
            />
            <div>
              <h1 className="text-lg font-extrabold text-[#0D47A1] leading-tight">
                ConectAgente
              </h1>
              <p className="text-[11px] text-[#6B7280] font-medium">
                Painel de Gestão
              </p>
            </div>
          </div>
        </div>

        {/* Form section */}
        <div className="flex-1 flex flex-col justify-center px-8 py-8">
          <div className="max-w-[380px] w-full mx-auto">
            <h2 className="text-2xl font-extrabold text-[#0F1621]">Entrar</h2>
            <p className="text-sm text-[#6B7280] mt-1 mb-8">
              Usar sua conta do sistema
            </p>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* CPF Field */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  CPF
                </label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(formatCPF(e.target.value))}
                  placeholder="Digite seu CPF"
                  className="w-full px-4 py-3 border border-[#D1D9E6] rounded-lg text-[#0F1621] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/30 focus:border-[#1565C0] transition-all bg-white"
                  inputMode="numeric"
                  autoComplete="off"
                />
              </div>

              {/* Senha Field */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Digite sua senha"
                    className="w-full px-4 py-3 border border-[#D1D9E6] rounded-lg text-[#0F1621] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/30 focus:border-[#1565C0] transition-all pr-12 bg-white"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors p-1"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Remember me checkbox */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-[#D1D9E6] text-[#1565C0] focus:ring-[#1565C0]/30"
                />
                <span className="text-sm text-[#6B7280]">Permanecer conectado</span>
              </label>

              {/* Error message */}
              {error && (
                <div className="bg-[#FFEBEE] border border-[#D32F2F]/20 text-[#D32F2F] text-sm px-4 py-3 rounded-lg flex items-center gap-2">
                  <Shield size={16} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Login Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg text-white font-semibold text-sm bg-[#1565C0] hover:bg-[#0D47A1] disabled:bg-[#9CA3AF] disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Entrando...
                  </span>
                ) : (
                  'Entrar'
                )}
              </button>

              {/* Separador + Demo */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#E5EAF2]" />
                <span className="text-xs text-[#9CA3AF]">ou</span>
                <div className="flex-1 h-px bg-[#E5EAF2]" />
              </div>

              <Link
                href="/demo"
                className="w-full py-3 rounded-lg text-[#1565C0] font-semibold text-sm bg-[#EEF2FF] hover:bg-[#DBEAFE] transition-colors border border-[#BFDBFE] flex items-center justify-center gap-2"
              >
                <span className="text-base">👤</span>
                <span>Acessar demonstração</span>
              </Link>

              {/* Link para registro */}
              <div className="text-center">
                <p className="text-sm text-[#6B7280]">
                  Não tem acesso?{' '}
                  <Link href="/registro" className="text-[#1565C0] hover:text-[#0D47A1] font-semibold">
                    Solicitar cadastro
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-[#E5EAF2]">
          <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
            Plataforma ConectAgente &mdash; Gestão de Agentes Comunitários de Saúde
          </p>
          <p className="text-[11px] text-[#9CA3AF]">
            Em conformidade com a LGPD (Lei 13.709/2018)
          </p>
        </div>
      </div>

      {/* Right Panel - Branding */}
      <div
        className="hidden lg:flex flex-1 flex-col items-center justify-center relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0A3D8F 0%, #0D47A1 30%, #1565C0 60%, #1976D2 100%)',
        }}
      >
        {/* Background pattern - health icons like Sicoob style */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'url("/health-pattern.svg")',
            backgroundSize: '240px 240px',
            backgroundRepeat: 'repeat',
          }}
        />

        {/* Content */}
        <div className="relative z-10 text-center px-12 max-w-lg">
          {/* Logo */}
          <Image
            src="/logo.png"
            alt="ConectAgente"
            width={110}
            height={110}
            className="object-contain rounded-3xl mx-auto mb-8 shadow-2xl"
          />

          {/* Main phrase - Sicoob style */}
          <div className="mb-6">
            <p className="text-2xl text-white/70 font-light italic leading-snug">Mais</p>
            <p className="text-lg text-white/60 font-light italic mb-3">que uma ferramenta de gestão.</p>
            <h2 className="text-[42px] font-extrabold text-white tracking-tight leading-tight">
              Saúde que{' '}
              <span className="text-[#64B5F6]">Conecta.</span>
            </h2>
          </div>

          <div className="inline-block bg-white/15 backdrop-blur-sm rounded-full px-6 py-2 border border-white/20">
            <span className="text-sm font-semibold text-white">conectagente.com.br</span>
          </div>
        </div>
      </div>
    </div>
  );
}
