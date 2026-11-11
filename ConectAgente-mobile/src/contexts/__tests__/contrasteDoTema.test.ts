/**
 * Contraste das duas paletas pelo critério WCAG 2.1 (nível AA).
 *
 * Nasceu de um relato de uso: no tema escuro, o nome do agente no Início e o
 * texto dos botões sumiam. A paleta escura tinha `white: '#1A1F2E'`, e o
 * "branco" sobre o gradiente azul dava 1,9:1. A medição achou também o laranja
 * de aviso, o verde secundário e o cinza fraco do tema claro abaixo de 4,5:1.
 *
 * Texto comum precisa de 4,5:1 contra o fundo onde aparece.
 */
import { PALETAS } from '../ThemeContext';

function luminancia(hex: string): number {
  const limpo = hex.replace('#', '');
  const canais = [0, 2, 4].map((i) => parseInt(limpo.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canais.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

const MINIMO_TEXTO = 4.5;

describe.each(Object.entries(PALETAS))('tema %s', (_nome, cores) => {
  const fundos = { fundo: cores.background, cartao: cores.card, superficieAlternativa: cores.surfaceAlt };
  const textos = {
    texto: cores.text,
    textoMedio: cores.textMedium,
    textoFraco: cores.textLight,
    primaria: cores.primary,
    secundaria: cores.secondary,
    erro: cores.error,
    sucesso: cores.success,
    aviso: cores.warning,
    informacao: cores.info,
  };

  const pares = Object.entries(textos).flatMap(([texto, cor]) =>
    Object.entries(fundos).map(([fundo, corDoFundo]) => [`${texto} sobre ${fundo}`, cor, corDoFundo] as const)
  );

  it.each(pares)('%s é legível', (_par, cor, fundo) => {
    expect(contraste(cor, fundo)).toBeGreaterThanOrEqual(MINIMO_TEXTO);
  });

  it.each(['primary', 'secondary', 'error', 'success', 'warning', 'info'] as const)(
    'texto sobre a cor sólida %s é legível',
    (corSolida) => {
      expect(contraste(cores.onSolid, cores[corSolida])).toBeGreaterThanOrEqual(MINIMO_TEXTO);
    }
  );

  it.each(cores.primaryGradient.map((parada, i) => [i, parada]))(
    'texto sobre o gradiente (parada %i) é legível',
    (_i, parada) => {
      expect(contraste(cores.onGradient, parada)).toBeGreaterThanOrEqual(MINIMO_TEXTO);
    }
  );

  it('placeholder é legível no campo', () => {
    expect(contraste(cores.placeholder, cores.inputBg)).toBeGreaterThanOrEqual(MINIMO_TEXTO);
  });
});
