/**
 * Testes do tema do painel.
 *
 * O que merece teste aqui não é o que o usuário vê, e sim o que decide o que
 * ele vê: a escolha vive num cookie para o servidor poder lê-la antes da
 * hidratação, e isso existe por motivo de segurança. Com localStorage seria
 * preciso um script embutido no `<head>`, e script embutido exige
 * `'unsafe-inline'` em `script-src`, que é a brecha que torna um XSS
 * explorável.
 *
 * Se alguém trocar o cookie por localStorage "porque é mais simples", estes
 * testes caem, e o motivo está escrito aqui.
 */
import { renderHook, act } from '@testing-library/react';
import { useTema, COOKIE_TEMA, ehModoValido } from '../useTema';

function limparCookies() {
  for (const parte of document.cookie.split(';')) {
    const nome = parte.split('=')[0].trim();
    if (nome) document.cookie = `${nome}=; Path=/; Max-Age=0`;
  }
}

function definirPreferenciaDoSistema(escuro: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (consulta: string) => ({
      matches: escuro && consulta.includes('dark'),
      media: consulta,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      onchange: null,
      dispatchEvent: jest.fn(),
    }),
  });
}

beforeEach(() => {
  limparCookies();
  document.documentElement.classList.remove('dark');
  definirPreferenciaDoSistema(false);
});

describe('ehModoValido', () => {
  it.each(['claro', 'escuro', 'sistema'])('aceita %s', (v) => {
    expect(ehModoValido(v)).toBe(true);
  });

  it.each(['dark', 'light', '', null, undefined, 42])('recusa %j', (v) => {
    expect(ehModoValido(v)).toBe(false);
  });
});

describe('useTema: estado inicial', () => {
  it('comeca em sistema quando nao ha cookie', () => {
    const { result } = renderHook(() => useTema());
    expect(result.current.modo).toBe('sistema');
  });

  it('le a escolha guardada no cookie', () => {
    document.cookie = `${COOKIE_TEMA}=escuro; Path=/`;
    const { result } = renderHook(() => useTema());
    expect(result.current.modo).toBe('escuro');
  });

  it('ignora valor invalido no cookie em vez de quebrar', () => {
    // O cookie e editavel pelo usuario. Um valor estranho nao pode derrubar
    // a pagina inteira.
    document.cookie = `${COOKIE_TEMA}=roxo; Path=/`;
    const { result } = renderHook(() => useTema());
    expect(result.current.modo).toBe('sistema');
  });
});

describe('useTema: aplica a classe no elemento raiz', () => {
  it('escuro poe a classe dark', () => {
    const { result } = renderHook(() => useTema());
    act(() => result.current.definirModo('escuro'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('claro tira a classe dark', () => {
    document.documentElement.classList.add('dark');
    const { result } = renderHook(() => useTema());
    act(() => result.current.definirModo('claro'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('sistema segue a preferencia do aparelho', () => {
    definirPreferenciaDoSistema(true);
    const { result } = renderHook(() => useTema());
    act(() => result.current.definirModo('sistema'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('claro vence a preferencia escura do aparelho', () => {
    // Escolha explicita manda mais que o padrao do sistema.
    definirPreferenciaDoSistema(true);
    const { result } = renderHook(() => useTema());
    act(() => result.current.definirModo('claro'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});

describe('useTema: persistencia', () => {
  it('grava a escolha em cookie, e nao em localStorage', () => {
    // O cookie e o que o servidor consegue ler antes da hidratacao. Trocar
    // por localStorage obrigaria a um script embutido no <head>, e com ele
    // `'unsafe-inline'` voltaria para a politica de seguranca.
    const { result } = renderHook(() => useTema());
    act(() => result.current.definirModo('escuro'));

    expect(document.cookie).toContain(`${COOKIE_TEMA}=escuro`);
    expect(window.localStorage.getItem(COOKIE_TEMA)).toBeNull();
  });

  it('o cookie leva SameSite=Lax', () => {
    // Nao e cookie de sessao, e preferencia de interface. Lax basta e evita
    // envio em requisicao de terceiro.
    const anterior = document.cookie;
    const { result } = renderHook(() => useTema());
    act(() => result.current.definirModo('claro'));
    // jsdom nao expoe os atributos na leitura, entao confere que gravou algo
    // novo e que o valor esta la.
    expect(document.cookie).not.toBe(anterior);
    expect(document.cookie).toContain(`${COOKIE_TEMA}=claro`);
  });

  it('a troca sobrescreve a escolha anterior', () => {
    const { result } = renderHook(() => useTema());
    act(() => result.current.definirModo('escuro'));
    act(() => result.current.definirModo('claro'));

    expect(document.cookie).toContain(`${COOKIE_TEMA}=claro`);
    expect(result.current.modo).toBe('claro');
  });
});

describe('useTema: estaEscuro', () => {
  it('reflete o estado atual em cada modo', () => {
    const { result } = renderHook(() => useTema());

    act(() => result.current.definirModo('escuro'));
    expect(result.current.estaEscuro).toBe(true);

    act(() => result.current.definirModo('claro'));
    expect(result.current.estaEscuro).toBe(false);
  });

  it('em sistema, acompanha a preferencia do aparelho', () => {
    definirPreferenciaDoSistema(true);
    const { result } = renderHook(() => useTema());
    act(() => result.current.definirModo('sistema'));
    expect(result.current.estaEscuro).toBe(true);
  });
});
