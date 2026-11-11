import { router } from 'expo-router';

/** Altura do conteúdo da barra de abas, sem contar a faixa dos botões do sistema. */
export const ALTURA_DO_CONTEUDO_DA_BARRA = 58;

/** Folga mínima embaixo, para aparelho com navegação por gestos e faixa zero. */
const FOLGA_MINIMA = 8;

/**
 * Medidas da barra de abas a partir da área ocupada pelos botões do Android.
 *
 * O estilo antigo somava espaço interno sem reservar essa área, e em aparelho
 * com os três botões do sistema os rótulos das abas ficavam por baixo deles.
 */
export function medidasDaBarraDeAbas(insetInferior: number): { height: number; paddingBottom: number } {
  const faixa = Math.max(insetInferior, FOLGA_MINIMA);
  return { height: ALTURA_DO_CONTEUDO_DA_BARRA + faixa, paddingBottom: faixa };
}

/**
 * Volta para a tela de onde a pessoa veio.
 *
 * O destino fixo só vale quando não há para onde voltar, como na tela aberta
 * direto depois de reiniciar o aplicativo. Antes ele era usado sempre, com
 * push, e o "voltar" abria uma tela nova em vez de voltar: o histórico se
 * embaralhava e o botão do celular levava para um lugar sem sentido.
 */
/**
 * Sai de um formulário salvo direto para o destino, sem deixar o formulário
 * no histórico. Nas abas o replace não remove a tela de onde se saiu: o voltar
 * caía de novo no formulário já salvo.
 */
export function sairDoFormularioPara(destino: Parameters<typeof router.push>[0]): void {
  if (router.canGoBack()) router.back();
  router.push(destino);
}

export function voltar(destinoSemHistorico?: string): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace((destinoSemHistorico ?? '/') as never);
}
