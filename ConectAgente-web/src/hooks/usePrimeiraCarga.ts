import { useRef } from 'react';

interface PrimeiraCarga {
  /** Verdadeiro uma única vez, e nunca se a página já veio com dado. */
  ehAPrimeira(): boolean;
  /** Volta ao estado inicial, para quando a tela precisa recarregar do zero. */
  reiniciar(): void;
}

/**
 * Diz se a tela deve mostrar o indicador de carregamento.
 *
 * Mostra só quando não há nada na tela ainda. Em troca de filtro a tela já tem
 * conteúdo, e piscar tudo a cada clique é pior que não piscar.
 *
 * Por que existe como hook e não como `if (lista.length === 0)` dentro da
 * função de busca. Quatro telas faziam exatamente isso, dentro de um
 * `useCallback` cuja lista de dependências não incluía a lista que era lida, e
 * o ESLint avisava em todas. Declarar a dependência não resolve: o `useEffect`
 * que chama a função depende dela, então a lista mudar recriaria a função, que
 * refaria a busca, que mudaria a lista. Laço.
 *
 * O objeto devolvido é guardado numa referência e tem identidade estável entre
 * renderizações. Isso importa: devolver um objeto novo a cada render faria o
 * ESLint cobrar `primeiraCarga` como dependência, e o laço voltaria por outro
 * caminho. Assim ele pode ficar de fora da lista com razão, e não por
 * omissão.
 *
 * @param temDadoInicial se a página já chegou com dado renderizado ou vindo do
 *   cache. Nesse caso não há primeira carga visível: o conteúdo já está lá, e
 *   o indicador nunca aparece.
 *
 * @example
 *   const primeiraCarga = usePrimeiraCarga(initCobertura != null);
 *
 *   const buscar = useCallback(async () => {
 *     if (primeiraCarga.ehAPrimeira()) setLoading(true);
 *     // ...
 *   }, [filtros]);
 */
export function usePrimeiraCarga(temDadoInicial = false): PrimeiraCarga {
  const faltaCarregar = useRef(!temDadoInicial);
  const api = useRef<PrimeiraCarga | null>(null);

  if (api.current === null) {
    api.current = {
      ehAPrimeira(): boolean {
        if (!faltaCarregar.current) return false;
        faltaCarregar.current = false;
        return true;
      },
      reiniciar(): void {
        faltaCarregar.current = true;
      },
    };
  }

  return api.current;
}
