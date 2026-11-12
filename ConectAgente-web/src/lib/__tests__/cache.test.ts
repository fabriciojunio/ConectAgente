/**
 * O cache guarda lista de pacientes, famílias e visitas. Estes testes
 * garantem que esse dado não fica no disco depois do "Sair" e não passa de
 * uma conta para outra no mesmo navegador.
 */

type Cache = typeof import('../cache');

function carregar(): Cache {
  let mod: Cache | undefined;
  jest.isolateModules(() => {
    mod = jest.requireActual<Cache>('../cache');
  });
  return mod!;
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('cache do painel', () => {
  it('grava na sessão da aba, e não no localStorage', () => {
    const { cacheSet } = carregar();
    cacheSet('moradores_1', [{ nome: 'Paciente' }]);
    expect(window.sessionStorage.getItem('ca_cache_moradores_1')).not.toBeNull();
    expect(window.localStorage.getItem('ca_cache_moradores_1')).toBeNull();
  });

  it('apaga o que versões antigas deixaram no localStorage', () => {
    window.localStorage.setItem('ca_cache_moradores_1', JSON.stringify({ data: [1], ts: Date.now() }));
    window.localStorage.setItem('conectagente_outra_coisa', 'fica');
    carregar();
    expect(window.localStorage.getItem('ca_cache_moradores_1')).toBeNull();
    expect(window.localStorage.getItem('conectagente_outra_coisa')).toBe('fica');
  });

  it('cacheClear apaga memória e navegador', () => {
    const { cacheSet, cacheGet, cacheClear } = carregar();
    cacheSet('visitas_1', [1, 2]);
    cacheClear();
    expect(cacheGet('visitas_1')).toBeNull();
    expect(window.sessionStorage.getItem('ca_cache_visitas_1')).toBeNull();
  });

  it('outra conta no mesmo navegador não vê o cache da anterior', () => {
    const { cacheSet, cacheGet, cacheBindUser } = carregar();
    cacheBindUser('conta-a');
    cacheSet('familias_1', ['da conta A']);
    cacheBindUser('conta-b');
    expect(cacheGet('familias_1')).toBeNull();
  });

  it('a mesma conta mantém o cache', () => {
    const { cacheSet, cacheGet, cacheBindUser } = carregar();
    cacheBindUser('conta-a');
    cacheSet('familias_1', ['da conta A']);
    cacheBindUser('conta-a');
    expect(cacheGet('familias_1')).toEqual(['da conta A']);
  });

  it('cache recarregado da sessão continua valendo depois de recarregar a página', () => {
    const primeiro = carregar();
    primeiro.cacheSet('dash_1', { total: 3 });
    const segundo = carregar();
    expect(segundo.cacheGet('dash_1')).toEqual({ total: 3 });
  });
});
