import { papelPodeAbrir, rotaRestrita } from '../rotasPorPapel';

describe('portão de rotas por papel', () => {
  it.each([
    ['/admin/usuarios', 'gerente', false],
    ['/admin/usuarios/abc', 'gerente', false],
    ['/admin/solicitacoes', 'gerente', false],
    ['/admin/usuarios', 'admin', true],
    ['/admin', 'gerente', true],
    ['/admin', 'coordenador', false],
    ['/minha-area', 'coordenador', true],
    ['/minha-area', 'agente', false],
    ['/visitas', 'agente', true],
    ['/', 'agente', true],
  ])('%s para %s: %s', (rota, papel, esperado) => {
    expect(papelPodeAbrir(rota, papel)).toBe(esperado);
  });

  it('papel desconhecido ou ausente não abre rota restrita', () => {
    expect(papelPodeAbrir('/admin', 'supervisor')).toBe(false);
    expect(papelPodeAbrir('/admin', null)).toBe(false);
  });

  it('prefixo parecido não engana o portão', () => {
    expect(rotaRestrita('/administracao-falsa')).toBe(false);
    expect(papelPodeAbrir('/adminx', 'agente')).toBe(true);
  });

  it('rotas de todos não pedem consulta de papel', () => {
    expect(rotaRestrita('/visitas')).toBe(false);
    expect(rotaRestrita('/admin')).toBe(true);
  });
});
