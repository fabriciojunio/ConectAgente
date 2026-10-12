/**
 * Testes da barreira anti-CSRF.
 *
 * O que ela impede: uma página maliciosa que a pessoa abra noutra aba dispara
 * uma escrita contra o painel, e o navegador manda o cookie de sessão junto.
 * Sem conferir a origem, a escrita acontece em nome de quem está logado, e no
 * caso deste sistema isso significa alterar prontuário de munícipe.
 */
import { validarOrigem, METODOS_ESCRITA } from '../csrf';

const HOST = 'painel.saude.bauru.sp.gov.br';

describe('validarOrigem: leitura passa', () => {
  it.each(['GET', 'HEAD', 'OPTIONS'])(
    '%s não é escrita e não é barrado nem sem origem',
    (metodo) => {
      expect(validarOrigem(metodo, null, null, HOST)).toEqual({ permitido: true });
    }
  );
});

describe('validarOrigem: escrita da própria origem passa', () => {
  it.each([...METODOS_ESCRITA])('%s com Origin igual ao host', (metodo) => {
    const r = validarOrigem(metodo, `https://${HOST}`, null, HOST);
    expect(r).toEqual({ permitido: true });
  });

  it('aceita Referer quando não há Origin', () => {
    // Alguns navegadores antigos omitem Origin em navegação de formulário.
    const r = validarOrigem('POST', null, `https://${HOST}/visitas`, HOST);
    expect(r).toEqual({ permitido: true });
  });

  it('ignora o caminho e a porta implícita, compara só o host', () => {
    const r = validarOrigem('POST', `https://${HOST}/qualquer/caminho`, null, HOST);
    expect(r).toEqual({ permitido: true });
  });
});

describe('validarOrigem: escrita de fora é barrada', () => {
  it('bloqueia origem de outro domínio', () => {
    const r = validarOrigem('POST', 'https://site-malicioso.example', null, HOST);
    expect(r).toEqual({
      permitido: false,
      status: 403,
      motivo: 'Origem não permitida.',
    });
  });

  it('bloqueia subdomínio parecido', () => {
    // `painel.saude.bauru.sp.gov.br.atacante.example` contém o host como
    // prefixo. Comparar por host inteiro, e não por "contém", é o que pega.
    const r = validarOrigem('POST', `https://${HOST}.atacante.example`, null, HOST);
    expect(r.permitido).toBe(false);
  });

  it('bloqueia escrita sem Origin e sem Referer', () => {
    // Navegador manda Origin em toda escrita desde 2020. A ausência indica
    // cliente que não é navegador, ou tentativa de contornar.
    const r = validarOrigem('POST', null, null, HOST);
    expect(r).toEqual({
      permitido: false,
      status: 403,
      motivo: 'Origem não informada.',
    });
  });

  it('bloqueia Origin que não é URL válida', () => {
    const r = validarOrigem('POST', 'nao-e-url', null, HOST);
    expect(r).toEqual({
      permitido: false,
      status: 403,
      motivo: 'Origem inválida.',
    });
  });

  it('bloqueia quando o host da requisição não chegou', () => {
    const r = validarOrigem('POST', `https://${HOST}`, null, null);
    expect(r.permitido).toBe(false);
  });

  it.each([...METODOS_ESCRITA])('bloqueia %s vindo de fora', (metodo) => {
    expect(validarOrigem(metodo, 'https://outro.example', null, HOST).permitido).toBe(
      false
    );
  });
});

describe('validarOrigem: detalhes que já passaram despercebidos em outros sistemas', () => {
  it('o método em minúsculas também conta como escrita', () => {
    // Quem monta a requisição à mão pode mandar "post".
    expect(validarOrigem('post', 'https://outro.example', null, HOST).permitido).toBe(
      false
    );
  });

  it('Origin tem prioridade sobre Referer', () => {
    // Referer pode ser forjado com mais facilidade em alguns cenários, e é
    // suprimido por política de referenciador. Origin manda.
    const r = validarOrigem(
      'POST',
      'https://outro.example',
      `https://${HOST}`,
      HOST
    );
    expect(r.permitido).toBe(false);
  });

  it('host com porta precisa bater inclusive na porta', () => {
    const comPorta = 'localhost:3000';
    expect(validarOrigem('POST', 'http://localhost:3000', null, comPorta).permitido).toBe(true);
    expect(validarOrigem('POST', 'http://localhost:4000', null, comPorta).permitido).toBe(false);
  });
});
