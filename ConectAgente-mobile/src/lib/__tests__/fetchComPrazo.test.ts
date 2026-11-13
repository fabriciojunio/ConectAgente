/**
 * Achado no S24 (12/11/2026): a tela apagou no meio do envio, a conexão
 * morreu sem resposta e a sincronização ficou parada em "Sincronizando..."
 * até fechar o app à força. Estes testes simulam a requisição que nunca
 * responde.
 */
import { comPrazo, fetchComPrazo, PRAZO_DA_REDE_MS } from '../fetchComPrazo';

/** fetch que só termina se for cancelado, como a conexão morta. */
function fetchQueNuncaResponde() {
  return jest.fn((_url: unknown, opcoes: RequestInit = {}) =>
    new Promise<Response>((_, rejeitar) => {
      opcoes.signal?.addEventListener('abort', () => rejeitar(new Error('Aborted')));
    }),
  );
}

describe('fetchComPrazo', () => {
  const original = global.fetch;
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    global.fetch = original;
  });

  it('requisição sem resposta falha no prazo, e não fica pendurada', async () => {
    global.fetch = fetchQueNuncaResponde() as unknown as typeof fetch;
    const pedido = fetchComPrazo('https://exemplo.test/rest/v1/visitas');
    jest.advanceTimersByTime(PRAZO_DA_REDE_MS);
    await expect(pedido).rejects.toThrow('Aborted');
  });

  it('o prazo padrão é curto o bastante para o uso em campo', () => {
    expect(PRAZO_DA_REDE_MS).toBeLessThanOrEqual(30_000);
  });

  it('resposta dentro do prazo passa normalmente', async () => {
    const resposta = { ok: true } as Response;
    global.fetch = jest.fn().mockResolvedValue(resposta) as unknown as typeof fetch;
    await expect(fetchComPrazo('https://exemplo.test')).resolves.toBe(resposta);
  });

  it('quem chamou ainda consegue cancelar', async () => {
    global.fetch = fetchQueNuncaResponde() as unknown as typeof fetch;
    const externo = new AbortController();
    const pedido = fetchComPrazo('https://exemplo.test', { signal: externo.signal });
    externo.abort();
    await expect(pedido).rejects.toThrow('Aborted');
  });
});

describe('comPrazo', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('operação que não termina é recusada com a mensagem dada', async () => {
    const travada = new Promise<void>(() => undefined);
    const resultado = comPrazo(travada, 1_000, 'A sincronização demorou demais.');
    jest.advanceTimersByTime(1_000);
    await expect(resultado).rejects.toThrow('A sincronização demorou demais.');
  });

  it('operação que termina devolve o próprio resultado', async () => {
    await expect(comPrazo(Promise.resolve(7), 1_000, 'x')).resolves.toBe(7);
  });
});
