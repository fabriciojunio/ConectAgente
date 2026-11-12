'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, MapPinned, Users } from 'lucide-react';
import { useAuth, avisarPerfilMudou } from '@/hooks/useAuth';
import { withTimeout } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  designarUnidade,
  escolherMinhaUnidade,
  listarEquipe,
  areaDaPessoa,
  listarUnidades,
  nomeUnidadeValido,
  type MembroEquipe,
  type UnidadeSaude,
} from '@/services/unidadeService';

const PAPEL: Record<MembroEquipe['role'], string> = {
  agente: 'Agente',
  coordenador: 'Coordenação',
  gerente: 'Gerência',
  admin: 'Administração',
};

const campo =
  'h-10 w-full rounded-md border border-[var(--borda)] bg-[var(--superficie)] px-3 text-sm text-[var(--texto)] placeholder-[var(--marcador)] focus:outline-none focus:border-[var(--primaria)]';

function Mensagem({ tipo, texto }: { tipo: 'ok' | 'erro'; texto: string }) {
  return (
    <p
      role={tipo === 'erro' ? 'alert' : 'status'}
      className={
        tipo === 'erro'
          ? 'rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'
          : 'rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700'
      }
    >
      {texto}
    </p>
  );
}

function TabelaEquipe({ pessoas, mostrarUnidade }: { pessoas: MembroEquipe[]; mostrarUnidade: boolean }) {
  if (pessoas.length === 0) {
    return <p className="px-4 py-6 text-sm text-[var(--texto-claro)]">Ninguém nesta lista.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--borda-clara)] text-left text-xs uppercase tracking-wide text-[var(--texto-claro)]">
            <th scope="col" className="px-4 py-2 font-semibold">Nome</th>
            <th scope="col" className="px-4 py-2 font-semibold">Papel</th>
            {mostrarUnidade && <th scope="col" className="px-4 py-2 font-semibold">Unidade</th>}
            <th scope="col" className="px-4 py-2 font-semibold">Área / microárea</th>
            <th scope="col" className="px-4 py-2 font-semibold">Situação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--borda-clara)]">
          {pessoas.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-2.5 font-medium text-[var(--texto)]">{p.nome}</td>
              <td className="px-4 py-2.5 text-[var(--texto-medio)]">{PAPEL[p.role]}</td>
              {mostrarUnidade && (
                <td className="px-4 py-2.5 text-[var(--texto-medio)]">
                  {p.unidade_saude?.trim() ? p.unidade_saude : <span className="text-orange-700">Sem unidade</span>}
                </td>
              )}
              <td className="px-4 py-2.5 text-[var(--texto-medio)]">
                {areaDaPessoa(p)}
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={
                    p.ativo
                      ? 'rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700'
                      : 'rounded-full bg-[var(--superficie-alt)] px-2 py-0.5 text-xs font-medium text-[var(--texto-claro)]'
                  }
                >
                  {p.ativo ? 'Ativa' : 'Desativada'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MinhaAreaPage() {
  const { user, loading } = useAuth();
  const [unidades, setUnidades] = useState<UnidadeSaude[]>([]);
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState('');

  const [nomeEscolhido, setNomeEscolhido] = useState('');
  const [pessoaId, setPessoaId] = useState('');
  const [unidadeDestino, setUnidadeDestino] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [retorno, setRetorno] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const role = user?.role;
  const gestao = role === 'gerente' || role === 'admin';
  const minhaUnidade = user?.unidade_saude?.trim() ?? '';

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroCarga('');
    try {
      const [u, e] = await Promise.all([withTimeout(listarUnidades()), withTimeout(listarEquipe())]);
      setUnidades(u);
      setEquipe(e);
    } catch (err) {
      setErroCarga(err instanceof Error ? err.message : 'Não foi possível carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (user) void carregar();
  }, [user, carregar]);

  const porUnidade = useMemo(() => {
    const mapa = new Map<string, MembroEquipe[]>();
    for (const u of unidades) mapa.set(u.nome, []);
    for (const p of equipe) {
      const chave = p.unidade_saude?.trim() ?? '';
      if (!chave) continue;
      mapa.set(chave, [...(mapa.get(chave) ?? []), p]);
    }
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
  }, [unidades, equipe]);

  const semUnidade = equipe.filter((p) => !p.unidade_saude?.trim() && p.ativo);

  async function definirMinhaArea(e: React.FormEvent) {
    e.preventDefault();
    setRetorno(null);
    if (!nomeUnidadeValido(nomeEscolhido)) {
      setRetorno({ tipo: 'erro', texto: 'Escolha uma unidade da lista ou digite um nome com pelo menos 3 letras.' });
      return;
    }
    setSalvando(true);
    try {
      const nome = await escolherMinhaUnidade(nomeEscolhido);
      setRetorno({ tipo: 'ok', texto: `Pronto. Sua área agora é ${nome}.` });
      avisarPerfilMudou();
      await carregar();
    } catch (err) {
      setRetorno({ tipo: 'erro', texto: err instanceof Error ? err.message : 'Não foi possível salvar.' });
    } finally {
      setSalvando(false);
    }
  }

  async function designar(e: React.FormEvent) {
    e.preventDefault();
    setRetorno(null);
    if (!pessoaId) {
      setRetorno({ tipo: 'erro', texto: 'Escolha o profissional.' });
      return;
    }
    if (!nomeUnidadeValido(unidadeDestino)) {
      setRetorno({ tipo: 'erro', texto: 'Escolha uma unidade da lista ou digite um nome com pelo menos 3 letras.' });
      return;
    }
    setSalvando(true);
    try {
      const nome = await designarUnidade(pessoaId, unidadeDestino);
      const pessoa = equipe.find((p) => p.id === pessoaId)?.nome ?? 'O profissional';
      setRetorno({ tipo: 'ok', texto: `${pessoa} agora está em ${nome}.` });
      setPessoaId('');
      setUnidadeDestino('');
      if (pessoaId === user?.id) avisarPerfilMudou();
      await carregar();
    } catch (err) {
      setRetorno({ tipo: 'erro', texto: err instanceof Error ? err.message : 'Não foi possível salvar.' });
    } finally {
      setSalvando(false);
    }
  }

  if (loading && !user) {
    return <div className="page-container"><p className="text-sm text-[var(--texto-claro)]">Carregando…</p></div>;
  }

  if (role === 'agente') {
    return (
      <div className="page-container">
        <h1 className="page-title">Áreas e equipes</h1>
        <p className="text-sm text-[var(--texto-medio)]">
          A área de cada agente é definida pela coordenação. Fale com a sua coordenação para mudar.
        </p>
      </div>
    );
  }

  const listaDeUnidades = (
    <datalist id="lista-unidades">
      {unidades.map((u) => (
        <option key={u.id} value={u.nome} />
      ))}
    </datalist>
  );

  return (
    <div className="page-container">
      <div>
        <h1 className="page-title">{gestao ? 'Áreas e equipes' : 'Minha área'}</h1>
        <p className="page-subtitle">
          {gestao
            ? 'Cada unidade é uma área. A coordenação de cada uma vê só a própria equipe e os próprios pacientes.'
            : 'A sua área define a equipe e os pacientes que aparecem para você no painel.'}
        </p>
      </div>

      {listaDeUnidades}
      {retorno && <Mensagem tipo={retorno.tipo} texto={retorno.texto} />}
      {erroCarga && <Mensagem tipo="erro" texto={erroCarga} />}

      {role === 'coordenador' && !minhaUnidade && (
        <section className="rounded-[var(--radius)] border border-[var(--borda-clara)] border-t-[3px] border-t-primary-500 bg-[var(--superficie)] p-5">
          <h2 className="flex items-center gap-2 text-base font-bold text-[var(--texto)]">
            <MapPinned size={18} className="text-primary-600" aria-hidden="true" />
            Defina a sua área
          </h2>
          <p className="mt-1 text-sm text-[var(--texto-medio)]">
            Escolha a sua unidade na lista. Se ela ainda não existe, digite o nome e ela é criada.
            Depois de definida, a troca é feita pela gerência.
          </p>
          <form onSubmit={definirMinhaArea} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="minha-unidade" className="mb-1 block text-xs font-medium text-[var(--texto-claro)]">
                Unidade de saúde
              </label>
              <input
                id="minha-unidade"
                list="lista-unidades"
                value={nomeEscolhido}
                onChange={(e) => setNomeEscolhido(e.target.value)}
                maxLength={120}
                placeholder="Ex.: UBS Jardim Europa"
                className={campo}
                autoComplete="off"
              />
            </div>
            <Button type="submit" loading={salvando}>Definir minha área</Button>
          </form>
        </section>
      )}

      {role === 'coordenador' && minhaUnidade && (
        <section className="rounded-[var(--radius)] border border-[var(--borda-clara)] bg-[var(--superficie)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--borda-clara)] px-4 py-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--texto-claro)]">Sua área</p>
              <p className="flex items-center gap-2 text-lg font-bold text-[var(--texto)]">
                <CheckCircle2 size={18} className="text-primary-600" aria-hidden="true" />
                {minhaUnidade}
              </p>
            </div>
            <p className="text-sm text-[var(--texto-claro)]">
              {equipe.length.toLocaleString('pt-BR')} {equipe.length === 1 ? 'pessoa' : 'pessoas'} na equipe · troca com a gerência
            </p>
          </div>
          {carregando ? (
            <p className="px-4 py-6 text-sm text-[var(--texto-claro)]">Carregando a equipe…</p>
          ) : (
            <TabelaEquipe pessoas={equipe} mostrarUnidade={false} />
          )}
        </section>
      )}

      {gestao && (
        <>
          <section aria-labelledby="titulo-unidades">
            <h2 id="titulo-unidades" className="section-title">Unidades</h2>
            {carregando ? (
              <p className="text-sm text-[var(--texto-claro)]">Carregando…</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {porUnidade.map(([nome, pessoas]) => {
                  const coordenacao = pessoas.filter((p) => p.role === 'coordenador' && p.ativo).map((p) => p.nome);
                  const agentes = pessoas.filter((p) => p.role === 'agente' && p.ativo).length;
                  return (
                    <div key={nome} className="rounded-[var(--radius)] border border-[var(--borda-clara)] bg-[var(--superficie)] p-4">
                      <p className="flex items-center gap-2 font-semibold text-[var(--texto)]">
                        <Building2 size={16} className="text-primary-600" aria-hidden="true" />
                        {nome}
                      </p>
                      <p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--texto-medio)]">
                        <Users size={14} aria-hidden="true" />
                        {agentes.toLocaleString('pt-BR')} {agentes === 1 ? 'agente ativo' : 'agentes ativos'}
                      </p>
                      <p className="mt-1 text-sm text-[var(--texto-claro)]">
                        Coordenação: {coordenacao.length > 0 ? coordenacao.join(', ') : <span className="text-orange-700">sem coordenação</span>}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-[var(--radius)] border border-[var(--borda-clara)] border-t-[3px] border-t-primary-500 bg-[var(--superficie)] p-5">
            <h2 className="text-base font-bold text-[var(--texto)]">Designar unidade</h2>
            <p className="mt-1 text-sm text-[var(--texto-medio)]">
              Coloca um profissional numa unidade. Unidade nova é criada aqui mesmo, digitando o nome.
              Toda designação fica na trilha de auditoria.
            </p>
            {semUnidade.length > 0 && (
              <p className="mt-2 text-sm text-orange-700">
                {semUnidade.length.toLocaleString('pt-BR')} {semUnidade.length === 1 ? 'conta ativa está' : 'contas ativas estão'} sem unidade.
              </p>
            )}
            <form onSubmit={designar} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div>
                <label htmlFor="pessoa" className="mb-1 block text-xs font-medium text-[var(--texto-claro)]">Profissional</label>
                <select id="pessoa" value={pessoaId} onChange={(e) => setPessoaId(e.target.value)} className={campo}>
                  <option value="">Escolha…</option>
                  {equipe
                    .filter((p) => p.ativo && (role === 'admin' || p.role !== 'admin'))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} · {PAPEL[p.role]}{p.unidade_saude?.trim() ? ` · ${p.unidade_saude}` : ' · sem unidade'}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label htmlFor="unidade-destino" className="mb-1 block text-xs font-medium text-[var(--texto-claro)]">Unidade</label>
                <input
                  id="unidade-destino"
                  list="lista-unidades"
                  value={unidadeDestino}
                  onChange={(e) => setUnidadeDestino(e.target.value)}
                  maxLength={120}
                  placeholder="Escolha ou digite"
                  className={campo}
                  autoComplete="off"
                />
              </div>
              <Button type="submit" loading={salvando}>Salvar</Button>
            </form>
          </section>

          <section className="rounded-[var(--radius)] border border-[var(--borda-clara)] bg-[var(--superficie)]" aria-labelledby="titulo-pessoas">
            <h2 id="titulo-pessoas" className="border-b border-[var(--borda-clara)] px-4 py-3 text-base font-bold text-[var(--texto)]">
              Todas as pessoas
            </h2>
            {carregando ? (
              <p className="px-4 py-6 text-sm text-[var(--texto-claro)]">Carregando…</p>
            ) : (
              <TabelaEquipe pessoas={equipe} mostrarUnidade />
            )}
          </section>
        </>
      )}
    </div>
  );
}
