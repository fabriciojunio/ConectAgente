'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { criarSolicitacao } from '@/app/actions/registro';
import { CheckCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function RegistroPage() {
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    telefone: '',
    cargo_pretendido: '' as 'supervisor' | 'outro' | '',
    cargo_outro: '',
    unidade_saude: '',
    area_atuacao: '',
    justificativa: '',
    senha: '',
    confirmarSenha: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function updateField(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validações locais
    if (!formData.cargo_pretendido) {
      setError('Selecione o cargo pretendido.');
      return;
    }

    if (formData.cargo_pretendido === 'outro' && !formData.cargo_outro.trim()) {
      setError('Informe qual cargo pretendido.');
      return;
    }

    const cpfDigits = formData.cpf.replace(/\D/g, '');
    if (cpfDigits.length !== 11) {
      setError('CPF inválido.');
      return;
    }

    if (formData.senha.length < 6) {
      setError('Senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (formData.senha !== formData.confirmarSenha) {
      setError('As senhas não coincidem.');
      return;
    }

    if (formData.justificativa.length < 10) {
      setError('Justificativa deve ter pelo menos 10 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const cargoFinal = formData.cargo_pretendido === 'outro'
        ? 'outro'
        : formData.cargo_pretendido;
      const cargoOutroTexto = formData.cargo_pretendido === 'outro'
        ? formData.cargo_outro.trim()
        : undefined;

      const result = await criarSolicitacao({
        nome: formData.nome.trim(),
        cpf: cpfDigits,
        telefone: formData.telefone.replace(/\D/g, '') || undefined,
        cargo_pretendido: cargoFinal as 'supervisor' | 'outro',
        cargo_outro: cargoOutroTexto,
        unidade_saude: formData.unidade_saude.trim(),
        area_atuacao: formData.area_atuacao.trim(),
        justificativa: formData.justificativa.trim(),
        senha: formData.senha,
      });

      if (!result.success) {
        setError(result.error || 'Erro ao enviar solicitação.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Erro ao conectar com o servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  // Tela de sucesso
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F6FA] px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-[#E8F5E9] rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-[#4CAF50]" />
          </div>
          <h2 className="text-xl font-bold text-[#0F1621] mb-2">
            Solicitação Enviada!
          </h2>
          <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
            Sua solicitação de registro foi enviada com sucesso.
            Um administrador irá analisar e aprovar seu cadastro.
            Você receberá acesso assim que for aprovado.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#1565C0] text-white rounded-lg text-sm font-semibold hover:bg-[#0D47A1] transition-colors"
          >
            <ArrowLeft size={16} />
            Voltar ao Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Form */}
      <div className="w-full lg:w-[560px] xl:w-[600px] flex flex-col bg-white">
        {/* Header */}
        <div className="px-8 pt-6 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="ConectAgente"
              width={40}
              height={40}
              className="object-contain rounded-lg"
            />
            <h1 className="text-lg font-extrabold text-[#0D47A1]">ConectAgente</h1>
          </div>
          <Link
            href="/login"
            className="text-sm text-[#1565C0] hover:text-[#0D47A1] font-medium flex items-center gap-1"
          >
            <ArrowLeft size={16} />
            Voltar
          </Link>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-[480px] mx-auto">
            <h2 className="text-2xl font-extrabold text-[#0F1621]">Solicitar Acesso</h2>
            <p className="text-sm text-[#6B7280] mt-1 mb-6">
              Preencha seus dados. Sua solicitação será analisada por um administrador.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  Nome completo *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => updateField('nome', e.target.value)}
                  placeholder="Seu nome completo"
                  required
                  className="w-full px-4 py-2.5 border border-[#D1D9E6] rounded-lg text-[#0F1621] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/30 focus:border-[#1565C0] transition-all text-sm"
                />
              </div>

              {/* CPF + Telefone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    CPF *
                  </label>
                  <input
                    type="text"
                    value={formData.cpf}
                    onChange={(e) => updateField('cpf', formatCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    required
                    inputMode="numeric"
                    className="w-full px-4 py-2.5 border border-[#D1D9E6] rounded-lg text-[#0F1621] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/30 focus:border-[#1565C0] transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={formData.telefone}
                    onChange={(e) => updateField('telefone', formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    inputMode="numeric"
                    className="w-full px-4 py-2.5 border border-[#D1D9E6] rounded-lg text-[#0F1621] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/30 focus:border-[#1565C0] transition-all text-sm"
                  />
                </div>
              </div>

              {/* Cargo pretendido */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  Cargo pretendido *
                </label>
                <select
                  value={formData.cargo_pretendido}
                  onChange={(e) => {
                    updateField('cargo_pretendido', e.target.value);
                    if (e.target.value !== 'outro') updateField('cargo_outro', '');
                  }}
                  required
                  className="w-full px-4 py-2.5 border border-[#D1D9E6] rounded-lg text-[#0F1621] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/30 focus:border-[#1565C0] transition-all text-sm bg-white"
                >
                  <option value="">Selecione o cargo</option>
                  <option value="supervisor">Supervisor(a)</option>
                  <option value="outro">Outro</option>
                </select>
                {formData.cargo_pretendido === 'outro' && (
                  <input
                    type="text"
                    value={formData.cargo_outro}
                    onChange={(e) => updateField('cargo_outro', e.target.value)}
                    placeholder="Informe qual cargo"
                    required
                    className="w-full mt-2 px-4 py-2.5 border border-[#D1D9E6] rounded-lg text-[#0F1621] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/30 focus:border-[#1565C0] transition-all text-sm"
                  />
                )}
                <p className="text-[11px] text-[#9CA3AF] mt-1">
                  Acesso de Administrador só pode ser concedido por outro admin.
                </p>
              </div>

              {/* Unidade + Área */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    Unidade de Saúde *
                  </label>
                  <input
                    type="text"
                    value={formData.unidade_saude}
                    onChange={(e) => updateField('unidade_saude', e.target.value)}
                    placeholder="Ex: UBS Central"
                    required
                    className="w-full px-4 py-2.5 border border-[#D1D9E6] rounded-lg text-[#0F1621] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/30 focus:border-[#1565C0] transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    Área de Atuação *
                  </label>
                  <input
                    type="text"
                    value={formData.area_atuacao}
                    onChange={(e) => updateField('area_atuacao', e.target.value)}
                    placeholder="Ex: Área 01"
                    required
                    className="w-full px-4 py-2.5 border border-[#D1D9E6] rounded-lg text-[#0F1621] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/30 focus:border-[#1565C0] transition-all text-sm"
                  />
                </div>
              </div>

              {/* Justificativa */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  Justificativa *
                </label>
                <textarea
                  value={formData.justificativa}
                  onChange={(e) => updateField('justificativa', e.target.value)}
                  placeholder="Explique por que você precisa deste nível de acesso. Ex: Sou coordenador(a) da equipe de ACS na UBS Central desde 2023..."
                  required
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-2.5 border border-[#D1D9E6] rounded-lg text-[#0F1621] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/30 focus:border-[#1565C0] transition-all text-sm resize-none"
                />
                <p className="text-[11px] text-[#9CA3AF] text-right mt-0.5">
                  {formData.justificativa.length}/500
                </p>
              </div>

              {/* Senha */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    Senha *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.senha}
                      onChange={(e) => updateField('senha', e.target.value)}
                      placeholder="Mín. 6 caracteres"
                      required
                      minLength={6}
                      className="w-full px-4 py-2.5 border border-[#D1D9E6] rounded-lg text-[#0F1621] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/30 focus:border-[#1565C0] transition-all text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    Confirmar Senha *
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.confirmarSenha}
                    onChange={(e) => updateField('confirmarSenha', e.target.value)}
                    placeholder="Repita a senha"
                    required
                    minLength={6}
                    className="w-full px-4 py-2.5 border border-[#D1D9E6] rounded-lg text-[#0F1621] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/30 focus:border-[#1565C0] transition-all text-sm"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-[#FFEBEE] border border-[#D32F2F]/20 text-[#D32F2F] text-sm px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {/* Submit */}
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
                    Enviando...
                  </span>
                ) : (
                  'Enviar Solicitação'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-3 border-t border-[#E5EAF2]">
          <p className="text-[11px] text-[#9CA3AF]">
            Em conformidade com a LGPD (Lei 13.709/2018)
          </p>
        </div>
      </div>

      {/* Right Panel - Branding */}
      <div
        className="hidden lg:flex flex-1 flex-col items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #0D47A1 0%, #1565C0 40%, #1976D2 70%, #42A5F5 100%)',
        }}
      >
        <div className="text-center px-12 max-w-lg">
          <Image
            src="/logo.png"
            alt="ConectAgente"
            width={100}
            height={100}
            className="object-contain rounded-3xl mx-auto mb-6 shadow-2xl"
          />
          <h2 className="text-2xl font-extrabold text-white mb-3">
            Solicite seu Acesso
          </h2>
          <p className="text-base text-white/75 leading-relaxed">
            O acesso ao painel é restrito a coordenadores e gerentes.
            Sua solicitação será validada por um administrador do sistema.
          </p>
        </div>
      </div>
    </div>
  );
}
