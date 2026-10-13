/**
 * Testes da detecção de servidor configurado.
 *
 * O defeito que estes testes travam foi encontrado compilando o APK de
 * release: o `.env` do projeto é cópia do `.env.example`, e o valor que vem
 * nele é `https://seu-projeto.supabase.co`. String não vazia, então a
 * verificação antiga dava servidor configurado, o cliente saía apontado para
 * um host que não existe, e a tela mostrava erro de rede.
 *
 * Num aplicativo que o agente usa em campo, isso é diagnóstico errado: ele
 * conclui que está sem sinal e vai procurar rede, quando o que falta é
 * configuração. A diferença importa porque o aplicativo é offline-first e
 * continuar trabalhando sem servidor é o comportamento correto, desde que ele
 * diga a verdade sobre o motivo.
 *
 * O painel web já recusava esses mesmos valores em `src/lib/env.ts`. Os dois
 * lados precisam da mesma regra, senão o mesmo `.env` meio preenchido dá
 * diagnóstico diferente em cada aplicativo.
 */
import { ehValorDeExemplo, TAMANHO_MINIMO_DA_CHAVE } from '../supabase';

describe('ehValorDeExemplo', () => {
  it.each([
    ['https://seu-projeto.supabase.co', 'a URL que vem no .env.example'],
    ['https://placeholder.supabase.co', 'o padrão que o painel web usava'],
    ['https://sua-api.com/v1', 'a API de exemplo'],
    ['SEU_ID', 'o identificador de exemplo da documentação'],
  ])('recusa %s (%s)', (valor) => {
    expect(ehValorDeExemplo(valor)).toBe(true);
  });

  it.each([
    'https://xyzabcdefghijkl.supabase.co',
    'https://conectagente.supabase.co',
  ])('aceita %s, que tem cara de endereço real', (valor) => {
    expect(ehValorDeExemplo(valor)).toBe(false);
  });

  it('não confunde projeto cujo nome contenha parte da marca', () => {
    // "meu-projeto" não é "seu-projeto". A busca precisa ser pela marca
    // inteira, e não por pedaço dela.
    expect(ehValorDeExemplo('https://meu-projeto-real.supabase.co')).toBe(false);
  });
});

describe('tamanho mínimo da chave', () => {
  it('a chave do .env.example não passa', () => {
    // O que está no arquivo de exemplo é só o cabeçalho de um JWT.
    const doExemplo = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    expect(doExemplo.length).toBeLessThan(TAMANHO_MINIMO_DA_CHAVE);
  });

  it('uma chave anon real passa', () => {
    expect('a'.repeat(210).length).toBeGreaterThanOrEqual(TAMANHO_MINIMO_DA_CHAVE);
  });
});

describe('supabaseConfigurado conforme o ambiente', () => {
  const CHAVE_REAL = 'a'.repeat(210);

  /**
   * Recarrega o módulo com o ambiente trocado.
   *
   * Precisa de `resetModules` porque a decisão é tomada uma vez, no carregamento
   * do módulo. Ler em tempo de uso seria pior: a configuração não muda com o
   * aplicativo aberto, e reler a cada chamada esconderia o erro em vez de
   * mostrá-lo no começo.
   */
  function carregarCom(url?: string, chave?: string): boolean {
    jest.resetModules();
    const anterior = { ...process.env };

    if (url === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = url;

    if (chave === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = chave;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../supabase').supabaseConfigurado as boolean;
    } finally {
      process.env = anterior;
    }
  }

  it('configurado quando URL e chave são reais', () => {
    expect(carregarCom('https://xyzabcdefghijkl.supabase.co', CHAVE_REAL)).toBe(true);
  });

  it('não configurado com o .env.example intocado', () => {
    // Este é exatamente o estado em que o APK foi compilado.
    expect(
      carregarCom('https://seu-projeto.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    ).toBe(false);
  });

  it('não configurado quando falta a URL', () => {
    expect(carregarCom(undefined, CHAVE_REAL)).toBe(false);
  });

  it('não configurado quando falta a chave', () => {
    expect(carregarCom('https://xyzabcdefghijkl.supabase.co', undefined)).toBe(false);
  });

  it('não configurado com URL real e chave truncada', () => {
    // O caso de quem copiou a chave pela metade.
    expect(carregarCom('https://xyzabcdefghijkl.supabase.co', 'eyJhbGciOi')).toBe(false);
  });

  it('o módulo carrega mesmo sem configuração nenhuma', () => {
    // O ponto do offline-first: sem servidor o aplicativo ainda abre. Antes,
    // o `createClient` lançava `supabaseUrl is required` na importação e
    // derrubava o aplicativo antes de qualquer tela aparecer.
    expect(() => carregarCom(undefined, undefined)).not.toThrow();
    expect(carregarCom(undefined, undefined)).toBe(false);
  });
});
