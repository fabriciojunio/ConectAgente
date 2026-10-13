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
import { ehValorDeExemplo, ehChavePublicaValida } from '../supabase';

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

describe('formato da chave pública', () => {
  // O Supabase tem dois formatos em circulação. Exigir 100 caracteres, como
  // estava aqui, recusava a chave nova em silêncio: o aplicativo dizia "não
  // configurado" com uma credencial boa, e o agente concluía que estava sem
  // sinal. Foi o que aconteceu com o projeto de verdade, em 13/10/2026.
  const JWT_REAL = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + 'a'.repeat(120) + '.assinatura';

  it.each([
    ['sb_publishable_ExemploDeChaveParaTeste_000000', 'o formato novo, com 46 caracteres'],
    [JWT_REAL, 'o JWT antigo'],
  ])('aceita %s (%s)', (chave) => {
    expect(ehChavePublicaValida(chave)).toBe(true);
  });

  it('recusa a chave do .env.example, que é só o cabeçalho do JWT', () => {
    expect(ehChavePublicaValida('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toBe(false);
  });

  it('recusa JWT truncado pela metade', () => {
    expect(ehChavePublicaValida('eyJhbGciOi.abc')).toBe(false);
  });

  it('recusa o prefixo novo sem nada depois', () => {
    expect(ehChavePublicaValida('sb_publishable_')).toBe(false);
  });

  it('recusa a chave secreta, mesmo bem formada', () => {
    // `sb_secret_` ignora o RLS por definição. No aplicativo ela iria dentro
    // do APK, à disposição de quem abrisse o arquivo. O formato novo deixa
    // isso visível; no JWT antigo as duas eram parecidas e a troca só
    // aparecia em produção.
    expect(ehChavePublicaValida('sb_secret_ExemploDeChaveParaTeste_000000')).toBe(false);
  });

  it('recusa texto solto', () => {
    expect(ehChavePublicaValida('minha-chave')).toBe(false);
  });
});

describe('supabaseConfigurado conforme o ambiente', () => {
  const CHAVE_REAL = 'sb_publishable_ExemploDeChaveParaTeste_000000';

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
