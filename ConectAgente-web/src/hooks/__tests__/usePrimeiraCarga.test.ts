/**
 * Testes do usePrimeiraCarga.
 *
 * Os dois comportamentos que importam e que não são óbvios:
 *
 *   1. O objeto devolvido tem identidade estável entre renderizações. Se não
 *      tivesse, declarar `primeiraCarga` na lista de dependências do
 *      `useCallback` recriaria a função a cada render, que refaria a busca,
 *      que renderizaria de novo. Laço. É justamente por ser estável que a
 *      dependência pode ser declarada em paz.
 *
 *   2. Página que já chegou com dado nunca mostra o indicador. Era o
 *      comportamento do código anterior (`if (lista.length === 0)`) e perder
 *      isso faria a tela piscar à toa em quem abre com cache quente.
 */
import { renderHook } from '@testing-library/react';
import { usePrimeiraCarga } from '../usePrimeiraCarga';

describe('usePrimeiraCarga', () => {
  it('a primeira chamada e verdadeira e as seguintes nao', () => {
    const { result } = renderHook(() => usePrimeiraCarga());

    expect(result.current.ehAPrimeira()).toBe(true);
    expect(result.current.ehAPrimeira()).toBe(false);
    expect(result.current.ehAPrimeira()).toBe(false);
  });

  it('nunca e a primeira quando a pagina ja chegou com dado', () => {
    const { result } = renderHook(() => usePrimeiraCarga(true));

    expect(result.current.ehAPrimeira()).toBe(false);
    expect(result.current.ehAPrimeira()).toBe(false);
  });

  it('mantem a mesma identidade entre renderizacoes', () => {
    // Sem isto, o ESLint cobra `primeiraCarga` como dependencia e declara-la
    // reintroduz o laco que o hook existe para evitar.
    const { result, rerender } = renderHook(() => usePrimeiraCarga());

    const primeiro = result.current;
    rerender();
    rerender();

    expect(result.current).toBe(primeiro);
  });

  it('nao perde o estado em nova renderizacao', () => {
    const { result, rerender } = renderHook(() => usePrimeiraCarga());

    expect(result.current.ehAPrimeira()).toBe(true);
    rerender();

    expect(result.current.ehAPrimeira()).toBe(false);
  });

  it('reiniciar faz valer a primeira de novo', () => {
    const { result } = renderHook(() => usePrimeiraCarga());

    result.current.ehAPrimeira();
    expect(result.current.ehAPrimeira()).toBe(false);

    result.current.reiniciar();
    expect(result.current.ehAPrimeira()).toBe(true);
  });

  it('o parametro so vale na montagem, nao em troca de valor', () => {
    // A referencia e inicializada uma vez. Trocar o argumento depois nao
    // ressuscita a primeira carga, e e isso que se quer: o dado ja apareceu.
    const { result, rerender } = renderHook(
      ({ tem }) => usePrimeiraCarga(tem),
      { initialProps: { tem: true } }
    );

    expect(result.current.ehAPrimeira()).toBe(false);
    rerender({ tem: false });
    expect(result.current.ehAPrimeira()).toBe(false);
  });
});
