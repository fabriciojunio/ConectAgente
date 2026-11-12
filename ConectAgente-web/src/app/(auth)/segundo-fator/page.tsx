'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { codigoValido } from '@/lib/segundoFator';

type Etapa =
  | { tipo: 'carregando' }
  | { tipo: 'cadastrar'; fatorId: string; qrCode: string; segredo: string }
  | { tipo: 'verificar'; fatorId: string }
  | { tipo: 'falha'; mensagem: string };

/**
 * Tela do segundo fator do painel.
 *
 * O middleware manda para cá toda sessão que entrou só com a senha. Na
 * primeira vez a conta cadastra um app autenticador (Google Authenticator,
 * Microsoft Authenticator, Aegis...) lendo o QR code; das próximas vezes,
 * só digita o código de 6 dígitos que o app mostra.
 */
export default function SegundoFatorPage() {
  const supabase = useMemo(() => createClient(), []);
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'carregando' });
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const preparar = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setEtapa({ tipo: 'falha', mensagem: 'Não foi possível carregar a segurança da conta. Recarregue a página.' });
      return;
    }

    const cadastrado = data.totp[0];
    if (cadastrado) {
      setEtapa({ tipo: 'verificar', fatorId: cadastrado.id });
      return;
    }

    // Cadastro que ficou pela metade (QR lido e página fechada antes do
    // código) bloqueia um novo com o mesmo nome. Só fator não verificado sai.
    for (const fator of data.all.filter((f) => f.status === 'unverified')) {
      await supabase.auth.mfa.unenroll({ factorId: fator.id });
    }

    // `issuer` é o nome que o app autenticador mostra na lista. Sem ele o
    // Supabase usa o endereço do site, e a conta aparecia como "localhost".
    const novo = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'ConectAgente',
      issuer: 'ConectAgente',
    });
    if (novo.error || !novo.data) {
      setEtapa({ tipo: 'falha', mensagem: 'Não foi possível iniciar o cadastro do autenticador. Tente de novo em instantes.' });
      return;
    }
    setEtapa({
      tipo: 'cadastrar',
      fatorId: novo.data.id,
      qrCode: novo.data.totp.qr_code,
      segredo: novo.data.totp.secret,
    });
  }, [supabase]);

  useEffect(() => {
    void preparar();
  }, [preparar]);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (etapa.tipo !== 'cadastrar' && etapa.tipo !== 'verificar') return;
    if (!codigoValido(codigo)) {
      setErro('Digite os 6 números que aparecem no app autenticador.');
      return;
    }

    setEnviando(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: etapa.fatorId, code: codigo });
    setEnviando(false);

    if (error) {
      setCodigo('');
      setErro('Código inválido ou vencido. Confira a hora do celular e use o código atual.');
      return;
    }
    // Navegação completa, e não router.push: o cookie com a sessão nova
    // (aal2) precisa ir na próxima requisição para o middleware liberar.
    window.location.replace('/');
  }

  async function sair() {
    await supabase.auth.signOut();
    window.location.replace('/login');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px] bg-[var(--superficie)] border border-[var(--borda-clara)] rounded-2xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck size={28} className="text-[var(--primaria)]" aria-hidden />
          <h1 className="text-xl font-extrabold text-[var(--texto)]">Verificação em duas etapas</h1>
        </div>

        {etapa.tipo === 'carregando' && (
          <p className="text-sm text-[var(--texto-claro)]">Carregando…</p>
        )}

        {etapa.tipo === 'falha' && (
          <p role="alert" className="text-sm text-[var(--erro)]">{etapa.mensagem}</p>
        )}

        {etapa.tipo === 'cadastrar' && (
          <div className="space-y-4 mb-6 text-sm text-[var(--texto-medio)]">
            <p>
              O painel mostra dado de saúde de muitas famílias, então a senha sozinha não basta.
              Abra um app autenticador no celular e leia o código abaixo.
            </p>
            <div className="flex justify-center bg-white rounded-xl p-3">
              <Image src={etapa.qrCode} alt="QR code para cadastrar o autenticador" width={180} height={180} unoptimized />
            </div>
            <p>
              Sem câmera? Digite esta chave no app:{' '}
              <code className="break-all font-mono text-[var(--texto)]">{etapa.segredo}</code>
            </p>
          </div>
        )}

        {etapa.tipo === 'verificar' && (
          <p className="text-sm text-[var(--texto-medio)] mb-6">
            Digite o código de 6 números que aparece agora no seu app autenticador.
          </p>
        )}

        {(etapa.tipo === 'cadastrar' || etapa.tipo === 'verificar') && (
          <form onSubmit={confirmar} className="space-y-4">
            <label htmlFor="codigo" className="block text-sm font-medium text-[var(--texto-medio)]">
              Código do autenticador
            </label>
            <input
              id="codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="000000"
              className="w-full px-4 py-3 border border-[var(--borda)] rounded-lg text-center text-2xl tracking-[0.5em] font-mono text-[var(--texto)] bg-[var(--superficie)] focus:outline-none"
            />
            {erro && <p role="alert" className="text-sm text-[var(--erro)]">{erro}</p>}
            <button
              type="submit"
              disabled={enviando}
              className="w-full py-3 rounded-lg text-white font-semibold text-sm bg-[var(--primaria)] hover:bg-[var(--primaria-escura)] disabled:bg-[var(--marcador)]"
            >
              {enviando ? 'Conferindo…' : 'Confirmar'}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={sair}
          className="mt-6 w-full text-sm text-[var(--texto-claro)] hover:text-[var(--texto)]"
        >
          Sair e entrar com outra conta
        </button>
      </div>
    </div>
  );
}
