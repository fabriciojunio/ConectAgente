'use client';

import { createClient } from '@/lib/supabase/client';
import { cacheClear, cacheGet, cacheSet } from '@/lib/cache';

export interface UnidadeSaude {
  id: string;
  nome: string;
}

const CHAVE_CATALOGO = 'unidades_catalogo';
const NOME_MIN = 3;
const NOME_MAX = 120;

/**
 * Normaliza o nome antes de mandar: tira espaço sobrando nas pontas e no
 * meio. O banco faz o mesmo `btrim`, e a regra de tamanho é a mesma do CHECK
 * da tabela; conferir aqui só evita a viagem quando já se sabe a resposta.
 */
export function normalizarNomeUnidade(nome: string): string {
  return nome.replace(/\s+/g, ' ').trim();
}

export function nomeUnidadeValido(nome: string): boolean {
  const n = normalizarNomeUnidade(nome);
  return n.length >= NOME_MIN && n.length <= NOME_MAX;
}

/**
 * Traduz o erro do banco para quem está usando. O detalhe técnico não vai
 * para a tela; a mensagem diz o que fazer.
 */
export function mensagemDeErroUnidade(erro: { code?: string; message?: string } | null): string {
  const msg = erro?.message ?? '';
  if (msg.includes('já foi escolhida')) {
    return 'Sua área já está definida. Para trocar, peça à gerência.';
  }
  if (erro?.code === '42501') return 'Sua conta não tem permissão para esta ação.';
  if (erro?.code === '22023') return `O nome da unidade precisa ter de ${NOME_MIN} a ${NOME_MAX} caracteres.`;
  if (erro?.code === 'P0002') return 'Esse profissional não foi encontrado.';
  return 'Não foi possível salvar agora. Confira a conexão e tente de novo.';
}

/** Catálogo de unidades, em ordem alfabética. */
export async function listarUnidades(): Promise<UnidadeSaude[]> {
  const cached = cacheGet<UnidadeSaude[]>(CHAVE_CATALOGO);
  if (cached) return cached;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('unidades_saude')
    .select('id, nome')
    .order('nome', { ascending: true });
  if (error) throw new Error('Não foi possível carregar as unidades.');
  const lista = (data as UnidadeSaude[]) ?? [];
  cacheSet(CHAVE_CATALOGO, lista);
  return lista;
}

/**
 * A coordenação escolhe uma unidade do catálogo ou cria a sua. Só vale uma
 * vez: depois, a troca é com a gerência (o banco recusa).
 */
export async function escolherMinhaUnidade(nome: string): Promise<string> {
  const limpo = normalizarNomeUnidade(nome);
  if (!nomeUnidadeValido(limpo)) throw new Error(mensagemDeErroUnidade({ code: '22023' }));

  const supabase = createClient();
  const { data, error } = await supabase.rpc('fn_escolher_minha_unidade', { p_nome: limpo });
  if (error) throw new Error(mensagemDeErroUnidade(error));
  // O escopo dos dados mudou: nada do que estava em cache vale mais.
  cacheClear();
  return (data as string) ?? limpo;
}

/** Gerência ou administração define a unidade de um profissional. */
export async function designarUnidade(agenteId: string, nome: string): Promise<string> {
  const limpo = normalizarNomeUnidade(nome);
  if (!nomeUnidadeValido(limpo)) throw new Error(mensagemDeErroUnidade({ code: '22023' }));

  const supabase = createClient();
  const { data, error } = await supabase.rpc('fn_designar_unidade', {
    p_agente_id: agenteId,
    p_nome: limpo,
  });
  if (error) throw new Error(mensagemDeErroUnidade(error));
  cacheClear();
  return (data as string) ?? limpo;
}

export interface MembroEquipe {
  id: string;
  nome: string;
  role: 'agente' | 'coordenador' | 'gerente' | 'admin';
  unidade_saude: string;
  area_atuacao: string;
  microarea: string | null;
  ativo: boolean;
}

/**
 * Pessoas que a conta pode ver, com a unidade de cada uma. O recorte é do
 * RLS de `agentes`: a coordenação recebe só a própria unidade, a gerência
 * recebe todas. Nenhum CPF, e-mail ou telefone: a tela não precisa.
 */
export async function listarEquipe(): Promise<MembroEquipe[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('agentes')
    .select('id, nome, role, unidade_saude, area_atuacao, microarea, ativo')
    .order('nome', { ascending: true });
  if (error) throw new Error('Não foi possível carregar a equipe.');
  return (data as MembroEquipe[]) ?? [];
}

/** "Microárea 001" e microárea "001" viram uma coisa só. */
export function areaDaPessoa(p: Pick<MembroEquipe, 'area_atuacao' | 'microarea'>): string {
  const area = p.area_atuacao?.trim() ?? '';
  const micro = p.microarea?.trim() ?? '';
  if (!area && !micro) return '—';
  if (!micro || area.includes(micro)) return area || micro;
  if (!area) return `Microárea ${micro}`;
  return `${area} · microárea ${micro}`;
}
