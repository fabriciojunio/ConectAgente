import { falhaDeConsulta } from './utils';
/** Teto padrão de linhas por resposta do PostgREST no Supabase. */
export const LINHAS_POR_LOTE = 1000;

type Lote<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/**
 * O PostgREST corta a resposta em 1.000 linhas sem erro e sem aviso, então
 * qualquer conta feita em cima do resultado saía errada e com cara de certa.
 * A busca segue em lotes até vir um lote menor que o teto. Cada lote monta a
 * consulta de novo porque o builder do Supabase só pode ser executado uma vez,
 * e a consulta precisa de uma ordem estável (com `id` no fim) para nenhum
 * registro repetir ou sumir entre um lote e outro.
 */
export async function buscarTudo<T>(
  lote: (de: number, ate: number) => Lote<T>,
  mensagemDeErro: string
): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += LINHAS_POR_LOTE) {
    const { data, error } = await lote(de, de + LINHAS_POR_LOTE - 1);
    if (error) throw falhaDeConsulta(mensagemDeErro.replace(/^Erro ao /, ''), error);
    linhas.push(...(data ?? []));
    if (!data || data.length < LINHAS_POR_LOTE) return linhas;
  }
}
