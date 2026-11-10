'use client';

import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { redefinirSenhaDeAcesso } from '@/app/actions/registro';

/**
 * Formulário para a coordenação redefinir a senha de sincronização.
 *
 * Quem recupera a senha no aplicativo troca só a senha do aparelho; a do
 * servidor fica a antiga e a sincronização para. O aplicativo avisa e manda
 * procurar a coordenação, que define aqui a mesma senha nova que o agente
 * escolheu no aparelho.
 *
 * A permissão é conferida no servidor (`redefinirSenhaDeAcesso`). Mostrar o
 * formulário a quem não pode só resulta na mensagem de recusa.
 */
export function SenhaDeSincronizacao({ agenteId }: { agenteId: string }) {
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setMensagem(null);
    if (senha !== confirmacao) {
      setMensagem({ tipo: 'erro', texto: 'As senhas não coincidem.' });
      return;
    }
    setEnviando(true);
    const resultado = await redefinirSenhaDeAcesso(agenteId, senha);
    setEnviando(false);
    if (resultado.success) {
      setSenha('');
      setConfirmacao('');
      setMensagem({
        tipo: 'ok',
        texto: 'Senha redefinida. O agente entra no aplicativo com ela e a sincronização volta.',
      });
    } else {
      setMensagem({ tipo: 'erro', texto: resultado.error ?? 'Não foi possível redefinir.' });
    }
  }

  return (
    <div className="bg-[var(--superficie)] rounded-xl border p-6">
      <h3 className="section-title flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-primary-600" />
        Senha de sincronização
      </h3>
      <p className="text-sm text-[var(--texto-claro)] mb-4">
        Use quando o agente recuperou a senha no aplicativo e a sincronização parou. Defina aqui a
        mesma senha nova que ele escolheu no aparelho.
      </p>
      <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm">
          <span className="block mb-1 text-[var(--texto-claro)]">Nova senha</span>
          <input
            type="password"
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 bg-[var(--superficie)]"
            required
          />
        </label>
        <label className="text-sm">
          <span className="block mb-1 text-[var(--texto-claro)]">Confirmar senha</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 bg-[var(--superficie)]"
            required
          />
        </label>
        <button
          type="submit"
          disabled={enviando}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
          Redefinir
        </button>
      </form>
      {mensagem && (
        <p
          role="status"
          className={`mt-3 text-sm ${mensagem.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}
        >
          {mensagem.texto}
        </p>
      )}
    </div>
  );
}
